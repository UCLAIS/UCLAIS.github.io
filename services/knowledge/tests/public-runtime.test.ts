import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { makeIndex } from '../src/core';
import type { Corpus, Release } from '../src/types';

describe('public S3 retrieval in the actual Workers runtime', () => {
  let mf: Miniflare; let worker: Awaited<ReturnType<Miniflare['getWorker']>>;
  beforeAll(async () => {
    const corpus: Corpus = { schemaVersion: 1, generatedAt: new Date().toISOString(), sources: [], learningPaths: [], documents: [{ id: 'faq:membership', title: 'Society membership', text: 'Join through the Students Union.', archived: false, topics: ['society'], type: 'faq', source: { url: 'https://uclai.co.uk/about-us/', status: 'approved' } }] };
    const release: Release = { id: '11111111-1111-1111-1111-111111111111', hash: 'a'.repeat(64), corpus, index: makeIndex(corpus).toJSON(), operationId: crypto.randomUUID(), previousReleaseId: null, createdAt: corpus.generatedAt };
    const pointer = { releaseId: release.id, hash: release.hash, operationId: release.operationId, previousReleaseId: null };
    const future = new Date(Date.now() + 86_400_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const lumaFeed = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:evt-runtime@events.lu.ma\r\nSUMMARY:Upcoming society workshop\r\nDTSTART:${future}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
    // Miniflare's loopback proxy changes Host; reconstruct the intended edge Host in this fixture only.
    const script = (await build({ stdin: { contents: `import app from './src/public-worker.ts'; export default { fetch(request, env) { const headers=new Headers(request.headers); headers.set('Host',new URL(request.url).host); return app.fetch(new Request(request,{headers}), {...env, RATE_LIMITER: {limit: async()=>({success:true})}}); } };`, resolveDir: process.cwd(), sourcefile: 'public-runtime-fixture.ts' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:workers', 'node:*'], logLevel: 'silent' })).outputFiles[0].text;
    mf = new Miniflare(convertV4MiniflareOptions({ workers: [
      { name: 'public', modules: true, script, compatibilityDate: '2026-10-29', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], bindings: { PUBLIC_ORIGIN: 'https://public.example', PUBLISHED_S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com', PUBLISHED_BUCKET_NAME: 'published', PUBLISHED_READ_ACCESS_KEY_ID: 'test-read-only-key', PUBLISHED_READ_SECRET_ACCESS_KEY: 'test-read-only-secret' }, outboundService: 'objects' },
      { name: 'objects', modules: true, script: `const pointer=${JSON.stringify(pointer)}; const release=${JSON.stringify(release)}; const calendar=${JSON.stringify(lumaFeed)}; export default { async fetch(request) { const url=new URL(request.url); if(url.hostname==='api.lu.ma' && url.pathname==='/ics/get') return new Response(calendar,{headers:{'Content-Type':'text/calendar'}}); if(!request.headers.get('Authorization')?.startsWith('AWS4-HMAC-SHA256 ') || request.redirect!=='manual') return new Response('Not safely signed',{status:403}); if(url.pathname==='/published/active.json') return Response.json(pointer,{headers:{etag:'"active-etag"'}}); if(url.pathname==='/published/releases/'+release.id+'.json') return Response.json(release,{headers:{etag:'"release-etag"'}}); return new Response(null,{status:404}); }};` },
    ] }));
    worker = await mf.getWorker('public');
  }, 60_000);
  afterAll(async () => { await mf?.dispose(); });
  it('loads the active manifest through signed, non-redirecting S3 GETs', async () => {
    const response = await worker.fetch('https://public.example/health'); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ready', releaseId: '11111111-1111-1111-1111-111111111111' });
  });
  it('searches and fetches through the production Worker handler', async () => {
    const response = await worker.fetch('https://public.example/api/search?query=membership'); expect(response.status).toBe(200);
    const result = await response.json() as any; expect(result.results[0].documentId).toBe('faq:membership');
    const fetch = await worker.fetch('https://public.example/api/resources/faq%3Amembership'); expect(fetch.status).toBe(200);
    expect(await fetch.json()).toMatchObject({ title: 'Society membership', freshness: 'published' });
  });
  it('queries the approved public Luma feed in the production Workers runtime', async () => {
    const response = await worker.fetch('https://public.example/api/events'); expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.calendar.status).toBe('available');
    expect(result.events[0].title).toBe('Upcoming society workshop');
    expect(Date.parse(result.events[0].event.start)).toBeGreaterThan(Date.now());
    expect(result.guidance.contact.email).toBe('info@uclai.co.uk');
  });
});
