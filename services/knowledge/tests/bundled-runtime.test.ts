import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildGithubKnowledge } from '../src/ingestion/github-content';
import type { Corpus } from '../src/types';

describe('bundled GitHub knowledge in the actual Workers runtime', () => {
  let mf: Miniflare; let worker: Awaited<ReturnType<Miniflare['getWorker']>>;
  beforeAll(async () => {
    const root = fileURLToPath(new URL('../../../', import.meta.url));
    const baseline = JSON.parse(await readFile(new URL('../data/bootstrap-corpus.json', import.meta.url), 'utf8')) as Corpus;
    await buildGithubKnowledge({ repoRoot: root, baseline, repository: 'UCLAIS/UCLAIS.github.io', revision: 'b'.repeat(40), generatedAt: '2026-10-29T12:00:00.000Z', outputDirectory: fileURLToPath(new URL('../.generated/', import.meta.url)) });
    // Only the loopback Host and rate limiter are adapted; the production handler,
    // generated full snapshot, index, cache and public tools run unmodified.
    const script = (await build({ stdin: { contents: `import app from './src/bundled-worker.ts'; export default { fetch(request,env) { const headers=new Headers(request.headers); headers.set('Host',new URL(request.url).host); return app.fetch(new Request(request,{headers}),{...env,RATE_LIMITER: {limit:async()=>{if(request.headers.has('x-test-limiter-error'))throw new Error('DO NOT DISCLOSE');return {success:!request.headers.has('x-test-limit')};}}}); } };`, resolveDir: process.cwd(), sourcefile: 'bundled-runtime-fixture.ts' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:workers', 'node:*'], logLevel: 'silent' })).outputFiles[0].text;
    mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'bundled', modules: true, script, compatibilityDate: '2026-10-29', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], bindings: { PUBLIC_ORIGIN: 'https://public.example' }, outboundService: 'calendar' }, { name: 'calendar', modules: true, script: `export default { fetch(request) { const url=new URL(request.url); if(url.hostname!=='api.lu.ma'||url.pathname!=='/ics/get')return new Response('Unexpected outbound request',{status:403});return new Response('BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nEND:VCALENDAR\\r\\n',{headers:{'Content-Type':'text/calendar'}}); } };` }] }));
    worker = await mf.getWorker('bundled');
  }, 60_000);
  afterAll(async () => { await mf?.dispose(); });
  it('serves the GitHub-added guide and actual ordered tutorial cells with no storage credentials', async () => {
    const guide = await worker.fetch('https://public.example/api/resources/knowledge%3Aguides%2Fadding-material.md'); expect(guide.status).toBe(200);
    expect(await guide.json()).toMatchObject({ type: 'guide', source: { revision: 'b'.repeat(40) } });
    const search = await worker.fetch('https://public.example/api/search?query=python'); const result = await search.json() as any;
    const cell = result.results.find((hit: any) => hit.sectionId.startsWith('cell-')); expect(cell).toBeDefined();
    const response = await worker.fetch(`https://public.example/api/resources/${encodeURIComponent(cell.documentId)}?sectionId=${cell.sectionId}&releaseId=${cell.releaseId}`);
    const doc = await response.json() as any; expect(doc.sections[0].locator).toContain('notebook cell'); expect(doc.text.length).toBeGreaterThan(0); expect(doc.guidance.contact.email).toBe('info@uclai.co.uk');
  });
  it('initialises the official MCP client and exposes only the five read-only tools', async () => {
    const client = new Client({ name: 'bundled-test', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL('https://public.example/mcp'), { fetch: async (input, init) => worker.fetch(new Request(input, init) as unknown as Parameters<typeof worker.fetch>[0]) as unknown as Promise<Response> }));
      const tools = (await client.listTools()).tools; expect(tools.map(tool => tool.name).sort()).toEqual(['fetch', 'get_learning_path', 'list_events', 'list_learning_paths', 'search']); expect(tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
      const result = await client.callTool({ name: 'search', arguments: { query: 'adding material' } }); expect(result.isError).not.toBe(true);
      const events = await client.callTool({ name: 'list_events', arguments: {} }); expect(events.isError).not.toBe(true); expect(JSON.stringify(events)).toContain('available');
    } finally { await client.close(); }
  });
  it('rejects write routes, encoded private paths, hostile origins and retired releases', async () => {
    for (const route of ['/mcp/imports', '/review', '/api/resources/..%2Fprivate', '/api/resources/draft%3Aguess']) expect((await worker.fetch(`https://public.example${route}`)).status).toBeGreaterThanOrEqual(400);
    expect((await worker.fetch('https://public.example/api/search?query=python', { headers: { Origin: 'https://hostile.example' } })).status).toBe(403);
    expect((await worker.fetch(`https://public.example/api/resources/knowledge%3Aguides%2Fadding-material.md?releaseId=${'c'.repeat(64)}`)).status).toBe(404);
  });
  it('fails closed on exhausted or failing rate limiting without logging exception contents', async () => {
    const limited = await worker.fetch('https://public.example/health', { headers: { 'x-test-limit': '1' } }); expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('60');
    const failed = await worker.fetch('https://public.example/health', { headers: { 'x-test-limiter-error': '1' } }); expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('DO NOT DISCLOSE');
  });
});
