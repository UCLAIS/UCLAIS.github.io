import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

const origin = 'https://manage.example';
describe('management sign-in and status in the actual Workers runtime', () => {
  let mf:Miniflare;
  let app:Awaited<ReturnType<Miniflare['getWorker']>>;
  let upstream:Awaited<ReturnType<Miniflare['getWorker']>>;
  async function signIn(code='valid-code') {
    const start = await app.fetch(origin+'/login', {redirect:'manual'});
    expect(start.status).toBe(302);
    const state = new URL(start.headers.get('Location')!).searchParams.get('state')!;
    return app.fetch(origin+'/auth/callback?'+new URLSearchParams({ state, code }), { redirect:'manual', headers:{ Cookie:start.headers.get('Set-Cookie')!.split(';')[0] } });
  }
  async function session() {
    const callback = await signIn();
    expect(callback.status).toBe(302);
    return callback.headers.get('Set-Cookie')!.match(/__Host-committee-session=([^;]+)/)![1];
  }
  beforeAll(async () => {
    // Adapt only the limiter/assets bindings. Production authentication, native
    // fetch/Request, cookie crypto, GitHub client and status code stay unchanged.
    const script = (await build({ stdin:{ contents:`import app from './src/management/worker.ts'; export default { fetch(request,env) { return app.fetch(request,{...env,RATE_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async()=>new Response('PRIVATE MANAGEMENT UI',{headers:{'Content-Type':'text/html'}})}}); } };`, resolveDir:process.cwd(), sourcefile:'management-runtime-fixture.ts' }, bundle:true, write:false, format:'esm', platform:'browser', target:'es2022', conditions:['workerd','worker','browser'], external:['cloudflare:workers','node:*'], logLevel:'silent' })).outputFiles[0].text;
    const remote = `let revoked=false, redirectApi=false, membership='active', unexpected=0;
export default { async fetch(request) {
  const url=new URL(request.url);
  if(url.hostname==='fixture.example') {
    if(url.pathname==='/revoke') revoked=true;
    if(url.pathname==='/grant') revoked=false;
    if(url.pathname==='/redirect-api') redirectApi=true;
    if(url.pathname==='/normal-api') redirectApi=false;
    if(url.pathname==='/membership') membership=url.searchParams.get('state')||'active';
    return Response.json({unexpected});
  }
  if(url.hostname==='github.com' && url.pathname==='/login/oauth/access_token') {
    const form=new URLSearchParams(await request.text());
    if(request.headers.get('User-Agent')!=='UCLAI-Committee'||!form.get('code_verifier')) return new Response('Invalid fixture request',{status:400});
    if(form.get('code')==='redirect-code') return new Response('Do not follow',{status:302,headers:{Location:'https://forbidden.example/collect'}});
    return Response.json({access_token:'runtime-test-user-token',expires_in:28800});
  }
  if(url.hostname==='api.github.com') {
    if(request.headers.get('Authorization')!=='Bearer runtime-test-user-token') return new Response('Invalid test token',{status:401});
    if(redirectApi) return new Response('Do not follow',{status:302,headers:{Location:'https://forbidden.example/collect'}});
    if(url.pathname==='/user') return Response.json({id:123,login:'member'});
    if(url.pathname==='/user/memberships/orgs/UCLAIS') {
      if(membership==='missing') return new Response('Not a member',{status:404});
      if(membership==='unavailable') return new Response('Provider unavailable',{status:503});
      if(membership==='blocked') return new Response('Missing app permission',{status:403});
      return Response.json({state:membership==='wrong-org'?'active':membership,organization:{id:membership==='wrong-org'?1:61075473}});
    }
    if(url.pathname==='/repos/UCLAIS/UCLAIS.github.io') return Response.json({permissions:{push:!revoked}});
    if(url.pathname==='/repos/UCLAIS/UCLAIS.github.io/pulls/89') return Response.json({state:'open',draft:false,title:'Review fixture',user:{id:456,login:'author'},base:{ref:'main',repo:{full_name:'UCLAIS/UCLAIS.github.io'}},head:{sha:'a'.repeat(40),ref:'committee/fixture',repo:{full_name:'UCLAIS/UCLAIS.github.io'}},changed_files:1});
    if(url.pathname==='/repos/UCLAIS/UCLAIS.github.io/pulls/89/files') return Response.json([{filename:'knowledge/faqs/example.md',status:'modified',patch:'@@ -1 +1 @@\\n-Old\\n+New'}]);
    if(url.pathname.endsWith('/actions/runs')) return Response.json({workflow_runs:[]});
    if(url.pathname.endsWith('/commits/main')) return Response.json({sha:'b'.repeat(40),commit:{tree:{sha:'c'.repeat(40)}}});
    if(url.pathname.includes('/git/trees/')) return Response.json({truncated:false,tree:[{path:'knowledge/faqs/example.md',type:'blob',mode:'100644',size:20,sha:'d'.repeat(40)}]});
  }
  if(url.hostname==='uclai.co.uk' && url.pathname==='/knowledge-status.json') return Response.json({releaseId:'a'.repeat(64),commit:'b'.repeat(40),materials:[{path:'knowledge/tutorials/lesson.md',firstSlide:'/materials/lesson/cover.webp',slideCount:1}]});
  if(url.hostname==='uclai.co.uk' && url.pathname==='/materials/lesson/cover.webp' && request.method==='HEAD') return new Response(null,{headers:{'Content-Type':'image/webp'}});
  if(url.hostname==='mcp.uclai.co.uk' && url.pathname==='/health') return Response.json({status:'ready',releaseId:'a'.repeat(64)});
  if(url.hostname==='mcp.uclai.co.uk' && url.pathname==='/api/events') return Response.json({calendar:{status:'available',expiresAt:new Date(Date.now()+60000).toISOString(),fetchedAt:new Date().toISOString(),skippedCount:0}});
  unexpected++; return new Response('Unexpected outbound fixture request',{status:500});
}};`;
    // The pinned local workerd predates the production compatibility date.
    // These native fetch/receiver contracts are unchanged by that date.
    mf = new Miniflare(convertV4MiniflareOptions({ workers:[{name:'management',modules:true,script,compatibilityDate:'2026-10-29',compatibilityFlags:['nodejs_compat','global_fetch_strictly_public'],bindings:{MANAGEMENT_ORIGIN:origin,GITHUB_CLIENT_ID:'fixture-client',GITHUB_CLIENT_SECRET:'fixture-secret',SESSION_SECRET:'s'.repeat(64)},outboundService:'upstream'},{name:'upstream',modules:true,script:remote}] }));
    app = await mf.getWorker('management'); upstream = await mf.getWorker('upstream');
  },60_000);
  afterAll(async()=>{await mf?.dispose();});
  it('exchanges OAuth, checks real network permissions and gates UI/API data', async()=>{
    expect((await app.fetch(origin+'/api/session')).status).toBe(401);
    const cookie = await session();
    const headers = {Cookie:'__Host-committee-session='+cookie};
    const info = await app.fetch(origin+'/api/session',{headers});
    expect(info.status).toBe(200); expect(await info.json()).toMatchObject({user:{id:123,login:'member'}});
    const ui = await app.fetch(origin+'/app.js',{headers});
    expect(await ui.text()).toBe('PRIVATE MANAGEMENT UI');
    const library = await app.fetch(origin+'/api/library',{headers});
    expect(library.status).toBe(200); expect(await library.json()).toMatchObject({files:[{path:'knowledge/faqs/example.md'}]});
    const review = await app.fetch(origin+'/api/proposal?number=89',{headers});
    expect(review.status).toBe(200); expect(await review.json()).toMatchObject({number:89,canApprove:true,head:'a'.repeat(40),files:[{path:'knowledge/faqs/example.md'}]});
    const status = await app.fetch(origin+'/api/status',{headers});
    expect(status.status).toBe(200);
    const body = await status.json() as any;
    expect(body.checks).toHaveLength(4); expect(body.checks.every((check:any)=>check.state==='ready')).toBe(true);
  });
  it('refuses OAuth and authenticated API redirects without forwarding credentials elsewhere', async()=>{
    const redirected = await signIn('redirect-code');
    expect(redirected.status).toBe(502); expect(await redirected.json()).toMatchObject({error:'login_response'});
    const cookie = await session();
    await upstream.fetch('https://fixture.example/redirect-api');
    try { expect((await app.fetch(origin+'/api/session',{headers:{Cookie:'__Host-committee-session='+cookie}})).status).toBe(502); }
    finally { await upstream.fetch('https://fixture.example/normal-api'); }
    expect(await (await upstream.fetch('https://fixture.example/stats')).json()).toMatchObject({unexpected:0});
  });
  it('denies an existing session immediately when repository write access disappears', async()=>{
    const cookie = await session();
    await upstream.fetch('https://fixture.example/revoke');
    try {
      const denied = await app.fetch(origin+'/app.js',{headers:{Cookie:'__Host-committee-session='+cookie}});
      expect(denied.status).toBe(403); expect(await denied.text()).not.toContain('PRIVATE MANAGEMENT UI');
    } finally { await upstream.fetch('https://fixture.example/grant'); }
  });
  it.each(['pending','missing','wrong-org','unavailable','blocked'])('denies sign-in and existing private sessions when membership is %s, even with repository write access', async state=>{
    const cookie = await session();
    await upstream.fetch('https://fixture.example/membership?state='+state);
    try {
      const expected = ['unavailable','blocked'].includes(state) ? 502 : 403;
      const callback = await signIn();
      expect(callback.status).toBe(expected);
      expect(callback.headers.get('Set-Cookie') || '').not.toContain('__Host-committee-session=');
      for(const path of ['/app.js','/api/library']) {
        const denied = await app.fetch(origin+path,{headers:{Cookie:'__Host-committee-session='+cookie}});
        expect(denied.status).toBe(expected); expect(await denied.text()).not.toContain('PRIVATE MANAGEMENT UI');
      }
    } finally { await upstream.fetch('https://fixture.example/membership?state=active'); }
  });
});
