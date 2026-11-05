import { afterEach, describe, expect, it, vi } from 'vitest';
import { ManagementEnv, seal, SESSION_COOKIE } from '../src/management/auth';
import { Github, REPOSITORY } from '../src/management/github';
import { approveProposal, proposalNumber, proposalReview } from '../src/management/reviews';
import { handleManagement } from '../src/management/worker';

const head = 'a'.repeat(40);
const proposal = () => ({state:'open',draft:false,title:'Lesson update',user:{id:456,login:'author'},base:{ref:'main',repo:{full_name:REPOSITORY}},head:{sha:head,ref:'committee/fixture',repo:{full_name:REPOSITORY}},changed_files:1});
const file = {filename:'knowledge/faqs/lesson.md',status:'modified',patch:'@@ -1 +1 @@\n-Old\n+<script>void(0)</script>'};
function fixture(pr: any = proposal(), files: any[] = [file]) {
  const network = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const target = new URL(String(url));
    expect(target.origin).toBe('https://api.github.com');
    const path = target.pathname;
    if (path === `/repos/${REPOSITORY}/pulls/89`) return Response.json(pr);
    if (path === `/repos/${REPOSITORY}/pulls/89/files`) return Response.json(files);
    if (path === `/repos/${REPOSITORY}/pulls/89/reviews` && init?.method === 'POST') return Response.json({id:99,state:'APPROVED',commit_id:head});
    throw new Error('Unexpected review request.');
  });
  return {github:new Github('test-review-token',network as typeof fetch),network};
}
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('GitHub-backed management approvals',()=>{
  it('returns reviewable text and fixed-repository links for another member',async()=>{
    const {github,network}=fixture();
    const result=await proposalReview(github,89,123);
    expect(result).toMatchObject({head,canApprove:true,author:'author'});
    expect(result.files[0]).toMatchObject({patch:file.patch,url:`https://github.com/${REPOSITORY}/blob/${head}/knowledge/faqs/lesson.md`});
    expect(network.mock.calls.every(([,init])=>init?.method==='GET')).toBe(true);
  });
  it('records exactly an APPROVE review at the reviewed commit, without merging',async()=>{
    const {github,network}=fixture();
    expect(await approveProposal(github,89,head,123)).toMatchObject({number:89,head,url:expect.stringContaining('#pullrequestreview-99')});
    const mutations=network.mock.calls.filter(([,init])=>init?.method==='POST');
    expect(mutations).toHaveLength(1);
    expect(String(mutations[0][0])).toBe(`https://api.github.com/repos/${REPOSITORY}/pulls/89/reviews`);
    expect(JSON.parse(String(mutations[0][1]?.body))).toEqual({event:'APPROVE',commit_id:head});
  });
  it('blocks self-approval on the server even when the browser is bypassed',async()=>{
    const {github,network}=fixture();
    expect((await proposalReview(github,89,456)).canApprove).toBe(false);
    await expect(approveProposal(github,89,head,456)).rejects.toMatchObject({code:'self_approval',status:403});
    expect(network.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  });
  it('refuses a changed head before sending any approval',async()=>{
    const {github,network}=fixture();
    await expect(approveProposal(github,89,'b'.repeat(40),123)).rejects.toMatchObject({code:'stale_review',status:409});
    expect(network.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  });
  it.each(['closed','draft','base','foreign-base','fork','non-management','invalid-head'])('refuses unsupported proposal scope: %s',async kind=>{
    const pr=proposal();
    if(kind==='closed') pr.state='closed';
    if(kind==='draft') pr.draft=true;
    if(kind==='base') pr.base.ref='other';
    if(kind==='foreign-base') pr.base.repo.full_name='other/repo';
    if(kind==='fork') pr.head.repo.full_name='other/repo';
    if(kind==='non-management') pr.head.ref='application-code';
    if(kind==='invalid-head') pr.head.sha='bad';
    const {github,network}=fixture(pr);
    await expect(approveProposal(github,89,head,123)).rejects.toMatchObject({code:'unsupported_proposal'});
    expect(network.mock.calls.some(([,init])=>init?.method==='POST')).toBe(false);
  });
  it('refuses incomplete file lists and bounds the diff preview',async()=>{
    const pr=proposal();pr.changed_files=2;
    await expect(proposalReview(fixture(pr).github,89,123)).rejects.toMatchObject({code:'incomplete_review'});
    pr.changed_files=5;
    const result=await proposalReview(fixture(pr,Array(5).fill({...file,patch:'x'.repeat(70000)})).github,89,123);
    expect(result.files.reduce((size,item)=>size+item.patch.length,0)).toBe(256*1024);
    expect(result.files.every(item=>item.limited)).toBe(true);
    pr.changed_files=101;
    await expect(proposalReview(fixture(pr).github,89,123)).rejects.toMatchObject({code:'large_proposal'});
  });
  it.each(['../89','89/reviews',0,-1,null,'01','89?repo=other',[89]])('rejects invalid proposal identifiers: %j',value=>{
    expect(()=>proposalNumber(value)).toThrow();
  });
  it('requires the authenticated reviewer, CSRF/Origin and explicit review confirmation at the API',async()=>{
    const env={MANAGEMENT_ORIGIN:'https://manage.uclai.co.uk',GITHUB_CLIENT_ID:'test',GITHUB_CLIENT_SECRET:'test-secret',SESSION_SECRET:'s'.repeat(64),RATE_LIMITER:{limit:async()=>({success:true})}} as unknown as ManagementEnv;
    const session={token:'test-review-session-token',csrf:'review-csrf',expires:Date.now()+60000};
    const cookie=await seal(env,'session',session);
    vi.spyOn(Github.prototype,'actor').mockResolvedValue({id:123,login:'reviewer',admin:false});
    const {network}=fixture();vi.stubGlobal('fetch',network);
    const request=(body:object,extra:Record<string,string>={})=>new Request(env.MANAGEMENT_ORIGIN+'/api/approve',{method:'POST',headers:{Cookie:`${SESSION_COOKIE}=${cookie}`,Origin:env.MANAGEMENT_ORIGIN,'X-CSRF-Token':session.csrf,'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
    expect((await handleManagement(request({number:89,head,reviewed:true},{Origin:'https://evil.example'}),env)).status).toBe(403);
    expect((await handleManagement(request({number:89,head,reviewed:true},{'X-CSRF-Token':''}),env)).status).toBe(403);
    expect((await handleManagement(request({number:89,head,reviewed:true},{Authorization:'Bearer forged'}),env)).status).toBe(403);
    expect((await handleManagement(request({number:89,head}),env)).status).toBe(400);
    expect((await handleManagement(request({number:89,head,reviewed:true,extra:'x'.repeat(9000)}),env)).status).toBe(413);
    expect(network).not.toHaveBeenCalled();
    const result=await handleManagement(request({number:89,head,reviewed:true,event:'MERGE',reviewerId:456,repository:'other/private'}),env);
    expect(result.status).toBe(201);expect(await result.text()).not.toContain(session.token);
    expect(JSON.parse(String(network.mock.calls.find(([,init])=>init?.method==='POST')?.[1]?.body))).toEqual({event:'APPROVE',commit_id:head});
    vi.mocked(Github.prototype.actor).mockResolvedValue({id:456,login:'author',admin:false});
    expect((await handleManagement(request({number:89,head,reviewed:true,reviewerId:123}),env)).status).toBe(403);
    expect(network.mock.calls.filter(([,init])=>init?.method==='POST')).toHaveLength(1);
    expect((await handleManagement(new Request(env.MANAGEMENT_ORIGIN+'/api/approve'),env)).status).toBe(401);
  });
});
