import { describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { approvedCorpus, makeIndex } from '../src/core';
import { createPublicHandler } from '../src/public-worker';
import { MemoryPublishedStore } from '../src/storage';
import type { Corpus, Release } from '../src/types';
import { readFileSync } from 'node:fs';

async function app() {
  const store = new MemoryPublishedStore();
  const corpus: Corpus = approvedCorpus({ schemaVersion: 1, generatedAt: '2026-10-29T12:00:00Z', sources: [], learningPaths: [], documents: [{ id: 'tutorial:python/week-1', title: 'Python introduction', text: 'Lists, functions and loops', type: 'tutorial', archived: true, topics: ['python'], source: { url: 'https://uclai.co.uk/tutorials/', status: 'approved' } }] });
  const release: Release = { id: crypto.randomUUID(), hash: 'a'.repeat(64), createdAt: corpus.generatedAt, previousReleaseId: null, corpus, index: makeIndex(corpus).toJSON(), operationId: crypto.randomUUID() };
  await store.putRelease(release); await store.compareAndSwapActive({ releaseId: release.id, hash: release.hash, operationId: release.operationId, previousReleaseId: null }, null);
  return { store, handler: createPublicHandler(store) };
}
describe('public boundaries and real MCP transport', () => {
  it('supports official SDK handshake, discovery and search', async () => {
    const { handler } = await app(); const client = new Client({ name: 'integration-test', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('https://knowledge.test/mcp'), { fetch: async (input, init) => handler(new Request(input, init)) });
    await client.connect(transport);
    const tools = await client.listTools(); expect(tools.tools.map(x => x.name).sort()).toEqual(['fetch', 'get_learning_path', 'list_events', 'list_learning_paths', 'search']);
    expect(tools.tools.every(x => x.annotations?.readOnlyHint === true)).toBe(true);
    const result = await client.callTool({ name: 'search', arguments: { query: 'Python' } }); expect(JSON.stringify(result)).toContain('tutorial:python/week-1');
    const guidance = JSON.parse((result.content as { text: string }[])[0].text).guidance;
    expect(guidance.contact.email).toBe('info@uclai.co.uk');
    expect(guidance.disclaimer).toContain('may be incorrect');
    expect(guidance.values.url).toContain('/about-us/');
    const hidden = await client.callTool({ name: 'publish', arguments: {} }).catch(error => error); expect(JSON.stringify(hidden)).not.toContain('publication succeeded');
    await client.close();
  });
  it('denies invalid origins, host mismatch and write methods', async () => {
    const { handler } = await app();
    expect((await handler(new Request('https://knowledge.test/mcp', { headers: { Origin: 'https://attacker.test' } }))).status).toBe(403);
    expect((await handler(new Request('https://knowledge.test/health', { headers: { Host: 'other.test' } }))).status).toBe(403);
    expect((await handler(new Request('https://knowledge.test/api/resources/test', { method: 'PUT', body: '{}' }))).status).toBe(405);
  });
  it('supports safe encoded resource IDs but denies arbitrary storage/draft/path lookups', async () => {
    const { handler } = await app();
    expect((await handler(new Request('https://knowledge.test/api/resources/tutorial%3Apython%2Fweek-1'))).status).toBe(200);
    for (const path of ['/drafts/secret', '/active.json', '/releases/secret.json', '/api/resources/..%2Fsecret', '/api/resources/%25secret']) expect((await handler(new Request(`https://knowledge.test${path}`))).status).toBeGreaterThanOrEqual(400);
  });
  it('validates query bounds and never includes raw exceptions in responses', async () => {
    const { handler, store } = await app();
    expect((await handler(new Request('https://knowledge.test/api/search?query=python&limit=1000'))).status).toBe(400);
    store.readActive = async () => { throw new Error('super-secret-token'); };
    const response = await handler(new Request('https://knowledge.test/health')); expect(response.status).toBe(503); expect(await response.text()).not.toContain('super-secret-token');
  });
  it('public deployment has no private or writable storage bindings', () => {
    const config = JSON.parse(readFileSync(new URL('../wrangler.public.jsonc', import.meta.url), 'utf8'));
    expect(config).not.toHaveProperty('r2_buckets'); expect(config).not.toHaveProperty('d1_databases'); expect(config).not.toHaveProperty('services');
  });
  it('directs unanswered, missing and out-of-scope questions to the committee without inventing an answer', async () => {
    const { handler } = await app();
    const empty = await (await handler(new Request('https://knowledge.test/api/search?query=unfindable-question'))).json() as any;
    expect(empty.results).toEqual([]);
    expect(empty.guidance.contact.email).toBe('info@uclai.co.uk');
    expect(empty.guidance.contact.when).toContain('Do not guess');
    const missing = await (await handler(new Request('https://knowledge.test/api/resources/nonexistent'))).json() as any;
    expect(missing.error).toBe('not_found');
    expect(missing.guidance.contact.url).toBe('mailto:info@uclai.co.uk');
    expect(missing.guidance.disclaimer).toContain('may be incorrect');
  });
});
