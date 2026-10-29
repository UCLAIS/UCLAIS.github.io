import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { uploadCorpus } from '../scripts/upload';

const directories: string[] = [];
const corpus = { schemaVersion: 1, generatedAt: '2026-10-29T00:00:00.000Z', documents: [], sources: [], learningPaths: [] };
async function fixture(body: string = JSON.stringify(corpus)) {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-upload-')); directories.push(directory);
  const corpusFile = join(directory, 'corpus.json'); await writeFile(corpusFile, body);
  return { corpusFile, editorUrl: 'https://editor.example/mcp', token: 'editor-token-secret' };
}
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });

describe('private corpus upload', () => {
  it('stages exact corpus JSON with bearer auth and redirect rejection, logging only a summary', async () => {
    const options = await fixture();
    const network = (async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://editor.example/mcp/imports');
      expect(init?.redirect).toBe('error');
      expect(init?.method).toBe('POST');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer editor-token-secret');
      expect(JSON.parse(String(init?.body))).toEqual(corpus);
      return Response.json({ draftId: 'safe-draft-id', revision: 1, documentCount: 0, conflicts: ['private-conflict-details'], privateBody: 'private-source-text' });
    }) as typeof fetch;
    const summary = await uploadCorpus(options, network);
    expect(summary.publication).toBe('not published');
    expect(summary.conflictCount).toBe(1);
    expect(summary.reviewUrl).toBe('https://editor.example/review');
    for (const secret of ['private-conflict-details', 'private-source-text', options.token]) expect(JSON.stringify(summary)).not.toContain(secret);
  });

  it('rejects missing tokens and non-MCP endpoints before network access', async () => {
    const options = await fixture(); let calls = 0;
    const network = (async () => { calls++; return new Response(); }) as typeof fetch;
    await expect(uploadCorpus({ ...options, token: '' }, network)).rejects.toThrow();
    await expect(uploadCorpus({ ...options, editorUrl: 'https://editor.example/review' }, network)).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it('rejects malformed, invalid and oversized corpus files before sending', async () => {
    let calls = 0;
    const network = (async () => { calls++; return new Response(); }) as typeof fetch;
    for (const body of ['{invalid', '{}', 'x'.repeat(10 * 1024 * 1024 + 1)]) await expect(uploadCorpus(await fixture(body), network)).rejects.toThrow();
    expect(calls).toBe(0);
  });

  it('rejects redirects and failed authorisation without echoing the remote body', async () => {
    const options = await fixture();
    for (const status of [307, 401, 403, 500]) {
      const network = (async () => new Response('private-body-do-not-echo', { status })) as typeof fetch;
      await expect(uploadCorpus(options, network)).rejects.toThrow('Import rejected');
    }
  });

  it('rejects unsafe response fields and oversized response bodies', async () => {
    const options = await fixture();
    const responses = [Response.json({ draftId: '<script>', revision: 1, documentCount: 0, conflicts: [] }), new Response('x'.repeat(65537))];
    for (const response of responses) await expect(uploadCorpus(options, (async () => response) as typeof fetch)).rejects.toThrow();
  });
});
