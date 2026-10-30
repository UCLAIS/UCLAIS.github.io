import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import gateway from '../src/hostname-gateway';

const endpoint = 'https://mcp.uclai.co.uk';
const upstream = 'https://uclai-knowledge-public-staging.uclai-society.workers.dev';
const service = () => ({ fetch: vi.fn(async (_request: Request) => Response.json({ ok: true })) });

describe('IONOS hostname gateway boundaries', () => {
  it('sends a browser visiting the hostname root to the society connection instructions', async () => {
    const backend = service(); const response = await gateway.fetch(new Request(`${endpoint}/`), { PUBLIC_KNOWLEDGE: backend });
    expect(response.status).toBe(302); expect(response.headers.get('Location')).toBe('https://uclai.co.uk/connect/'); expect(backend.fetch).not.toHaveBeenCalled();
  });
  it('forwards only to the fixed public Worker, strips credentials and preserves protocol data and the edge IP', async () => {
    const backend = service();
    const payload = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const response = await gateway.fetch(new Request(`${endpoint}/mcp`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer private-token', Cookie: 'private-session', 'X-Forwarded-For': 'spoofed', 'X-Real-IP': 'spoofed', 'X-Target': 'http://127.0.0.1/private', 'MCP-Protocol-Version': '2026-07-28', 'CF-Connecting-IP': '192.0.2.20' } }), { PUBLIC_KNOWLEDGE: backend });
    expect(response.status).toBe(200);
    const forwarded = backend.fetch.mock.calls[0][0];
    expect(forwarded.url).toBe(`${upstream}/mcp`);
    expect(await forwarded.text()).toBe(payload);
    expect(forwarded.redirect).toBe('manual');
    expect(forwarded.headers.get('MCP-Protocol-Version')).toBe('2026-07-28');
    expect(forwarded.headers.get('CF-Connecting-IP')).toBe('192.0.2.20');
    for (const name of ['Authorization', 'Cookie', 'X-Forwarded-For', 'X-Real-IP', 'X-Target', 'Host']) expect(forwarded.headers.has(name)).toBe(false);
  });
  it.each(['/review', '/admin/mcp', '/drafts/123', '/api/private', '/mcp/imports', '/%2e%2e/private'])('refuses nonpublic paths without invoking a service: %s', async path => {
    const backend = service();
    expect((await gateway.fetch(new Request(`${endpoint}${path}`), { PUBLIC_KNOWLEDGE: backend })).status).toBe(404);
    expect(backend.fetch).not.toHaveBeenCalled();
  });
  it.each(['http://mcp.uclai.co.uk/mcp', 'https://hostile.example/mcp', 'https://preview.uclai-mcp.pages.dev/mcp'])('rejects unapproved hosts and protocols: %s', async url => {
    const backend = service(); expect((await gateway.fetch(new Request(url), { PUBLIC_KNOWLEDGE: backend })).status).toBe(403); expect(backend.fetch).not.toHaveBeenCalled();
  });
  it('keeps queries and encoded resource IDs on the fixed backend, never turning them into fetch destinations', async () => {
    const backend = service(); const path = '/api/resources/knowledge%3Atutorials%2Flesson.md?releaseId=abcdef1234567890';
    await gateway.fetch(new Request(`${endpoint}${path}`), { PUBLIC_KNOWLEDGE: backend });
    expect(backend.fetch.mock.calls[0][0].url).toBe(`${upstream}${path}`);
  });
  it('rejects writes to HTTP retrieval routes and oversized or compressed bodies before forwarding', async () => {
    const backend = service();
    expect((await gateway.fetch(new Request(`${endpoint}/api/events`, { method: 'POST' }), { PUBLIC_KNOWLEDGE: backend })).status).toBe(405);
    expect((await gateway.fetch(new Request(`${endpoint}/mcp`, { method: 'POST', body: 'x'.repeat(65_537) }), { PUBLIC_KNOWLEDGE: backend })).status).toBe(413);
    expect((await gateway.fetch(new Request(`${endpoint}/mcp`, { method: 'POST', headers: { 'Content-Length': '65537' } }), { PUBLIC_KNOWLEDGE: backend })).status).toBe(413);
    expect((await gateway.fetch(new Request(`${endpoint}/mcp`, { method: 'POST', body: 'gzip', headers: { 'Content-Encoding': 'gzip' } }), { PUBLIC_KNOWLEDGE: backend })).status).toBe(415);
    expect(backend.fetch).not.toHaveBeenCalled();
  });
  it('preserves rate limits and CORS without caching or forwarding cookies', async () => {
    const result = await gateway.fetch(new Request(`${endpoint}/health`, { headers: { Origin: 'https://uclai.co.uk' } }), { PUBLIC_KNOWLEDGE: { fetch: async request => {
      expect(request.headers.get('Origin')).toBe('https://uclai.co.uk');
      return new Response('limited', { status: 429, headers: { 'Retry-After': '60', 'Access-Control-Allow-Origin': 'https://uclai.co.uk', 'Set-Cookie': 'must-not-forward', 'Cache-Control': 'public, max-age=60' } });
    } } });
    expect(result.status).toBe(429); expect(result.headers.get('Retry-After')).toBe('60'); expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://uclai.co.uk'); expect(result.headers.get('Cache-Control')).toBe('no-store'); expect(result.headers.has('Set-Cookie')).toBe(false);
  });
  it('cancels a body that stalls when the incoming request is aborted', async () => {
    const controller = new AbortController(); const cancel = vi.fn(); const backend = service();
    const body = new ReadableStream({ start(stream) { stream.enqueue(new Uint8Array([123])); }, cancel });
    const request = new Request(`${endpoint}/mcp`, { method: 'POST', body, signal: controller.signal, duplex: 'half' } as RequestInit);
    const pending = gateway.fetch(request, { PUBLIC_KNOWLEDGE: backend });
    controller.abort();
    expect((await pending).status).toBe(413); expect(cancel).toHaveBeenCalledOnce(); expect(backend.fetch).not.toHaveBeenCalled();
  });
  it('does not redirect clients elsewhere or disclose internal errors', async () => {
    const redirected = await gateway.fetch(new Request(`${endpoint}/health`), { PUBLIC_KNOWLEDGE: { fetch: async () => Response.redirect('https://hostile.example/private', 307) } });
    expect(redirected.status).toBe(502); expect(redirected.headers.has('Location')).toBe(false);
    const failed = await gateway.fetch(new Request(`${endpoint}/health`), { PUBLIC_KNOWLEDGE: { fetch: async () => { throw new Error('PRIVATE CONTENT OR TOKEN'); } } });
    expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('PRIVATE CONTENT OR TOKEN');
    expect((await gateway.fetch(new Request(`${endpoint}/health`), {} as any)).status).toBe(503);
  });
  it('records only the public Worker service binding and no storage, AI or secret variables', async () => {
    const config = JSON.parse(await readFile(new URL('../wrangler.hostname.jsonc', import.meta.url), 'utf8'));
    expect(Object.keys(config).sort()).toEqual(['$schema', 'name', 'pages_build_output_dir', 'compatibility_date', 'services'].sort());
    expect(config.services).toEqual([{ binding: 'PUBLIC_KNOWLEDGE', service: 'uclai-knowledge-public-staging' }]);
  });
});

describe('MCP through the hostname gateway in the actual Workers runtime', () => {
  let runtime: Miniflare; let worker: Awaited<ReturnType<Miniflare['getWorker']>>;
  beforeAll(async () => {
    const compile = async (contents: string) => (await build({ stdin: { contents, resolveDir: process.cwd(), sourcefile: 'hostname-runtime-fixture.ts' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:workers', 'node:*'], logLevel: 'silent' })).outputFiles[0].text;
    const frontend = await compile("export { default } from './src/hostname-gateway.ts';");
    const backend = await compile(`import {createPublicHandler} from './src/public-worker.ts'; import {bundledStore} from './src/bundled-store.ts'; import {makeIndex} from './src/core.ts';
const corpus={schemaVersion:1,generatedAt:'2026-10-30T00:00:00.000Z',sources:[],learningPaths:[],documents:[{id:'faq:membership',title:'Society membership',text:'Standard membership costs £5.',topics:['membership'],type:'faq',archived:false,source:{url:'https://uclai.co.uk/about-us/',status:'approved'}}]};
const release={id:'a'.repeat(64),hash:'b'.repeat(64),corpus,index:makeIndex(corpus).toJSON(),operationId:'hostname-test',previousReleaseId:null,createdAt:corpus.generatedAt};
const handler=createPublicHandler(bundledStore(release),undefined,release);
export default {fetch(request){if(request.headers.get('CF-Connecting-IP')==='192.0.2.99')return new Response('limited',{status:429,headers:{'Retry-After':'60'}});const headers=new Headers(request.headers);headers.set('Host',new URL(request.url).host);return handler(new Request(request,{headers}),{PUBLIC_ORIGIN:${JSON.stringify(upstream)}});}};`);
    runtime = new Miniflare(convertV4MiniflareOptions({ workers: [
      { name: 'gateway', modules: true, script: frontend, compatibilityDate: '2026-10-30', serviceBindings: { PUBLIC_KNOWLEDGE: 'public' } },
      { name: 'public', modules: true, script: backend, compatibilityDate: '2026-10-30', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'] },
    ] }));
    worker = await runtime.getWorker('gateway');
  }, 60_000);
  afterAll(async () => { await runtime?.dispose(); });
  it('initialises the official SDK, discovers five read-only tools and retrieves the cited price through the binding', async () => {
    const client = new Client({ name: 'hostname-test', version: '1' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`${endpoint}/mcp`), { fetch: async (input, init) => worker.fetch(new Request(input, init) as unknown as Parameters<typeof worker.fetch>[0]) as unknown as Promise<Response> }));
      const tools = (await client.listTools()).tools;
      expect(tools.map(tool => tool.name).sort()).toEqual(['fetch', 'get_learning_path', 'list_events', 'list_learning_paths', 'search']); expect(tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
      const result = await client.callTool({ name: 'search', arguments: { query: 'membership' } }); expect(result.isError).not.toBe(true); expect(JSON.stringify(result)).toContain('£5');
      const resource = await worker.fetch(`${endpoint}/api/resources/faq%3Amembership?releaseId=${'a'.repeat(64)}`); expect(resource.status).toBe(200); expect(await resource.json()).toMatchObject({ text: 'Standard membership costs £5.', source: { url: 'https://uclai.co.uk/about-us/' } });
    } finally { await client.close(); }
  });
  it('preserves backend Origin rejection, private-resource rejection, old-release rejection and the edge IP for rate limits', async () => {
    expect((await worker.fetch(`${endpoint}/health`, { headers: { Origin: 'https://hostile.example' } })).status).toBe(403);
    for (const path of ['/api/resources/draft%3Aguess', '/api/resources/..%2Fprivate', `/api/resources/faq%3Amembership?releaseId=${'c'.repeat(64)}`]) expect((await worker.fetch(`${endpoint}${path}`)).status).toBeGreaterThanOrEqual(400);
    const limited = await worker.fetch(`${endpoint}/health`, { headers: { 'CF-Connecting-IP': '192.0.2.99' } }); expect(limited.status).toBe(429); expect(limited.headers.get('Retry-After')).toBe('60');
  });
});
