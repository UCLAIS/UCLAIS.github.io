import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Corpus } from '../src/types.js';
import { publicCorpus } from '../src/ingestion/importer.js';
import { importedContentHash, reconcileImport } from '../src/ingestion/reconcile.js';
import { discoverLinks, parseHtmlCopy, parseMarkdown, parseNotebook, parseReactCopy } from '../src/ingestion/parse.js';
import { containedPath, decodeText, fetchApproved, MAX_SOURCE_BYTES, readBoundedResponse, validateFetchUrl, validateRepositoryPath } from '../src/ingestion/security.js';

const temporaryDirectories: string[] = [];
afterEach(async () => { for (const dir of temporaryDirectories.splice(0)) await rm(dir, { recursive: true, force: true }); });

describe('source request boundary', () => {
  const commit = 'a'.repeat(40);
  it('allows only exact publisher-selected pinned repository endpoints', () => {
    expect(validateFetchUrl(`https://raw.githubusercontent.com/UCLAIS/ml-tutorials-season-5/${commit}/week-1/lesson.ipynb`).hostname).toBe('raw.githubusercontent.com');
    expect(validateFetchUrl('https://api.github.com/repos/UCLAIS/ml-tutorials-season-5/commits/main').hostname).toBe('api.github.com');
    expect(validateFetchUrl('https://agentverse.uclai.co.uk/').hostname).toBe('agentverse.uclai.co.uk');
  });
  it.each([
    'http://127.0.0.1/admin', 'https://169.254.169.254/latest/meta-data/', 'file:///etc/passwd',
    'https://raw.githubusercontent.com.attacker.example/UCLAIS/ml-tutorials-season-5/README.md',
    'https://raw.githubusercontent.com@attacker.example/UCLAIS/ml-tutorials-season-5/README.md',
    `https://user:secret@raw.githubusercontent.com/UCLAIS/ml-tutorials-season-5/${commit}/README.md`,
    `https://raw.githubusercontent.com:8443/UCLAIS/ml-tutorials-season-5/${commit}/README.md`,
    'https://raw.githubusercontent.com/UCLAIS/ml-tutorials-season-5/main/README.md',
    `https://raw.githubusercontent.com/UCLAIS/private-repo/${commit}/secret.md`,
    `https://raw.githubusercontent.com/UCLAIS/ml-tutorials-season-5/${commit}/%2e%2e/secret.md`,
    `https://raw.githubusercontent.com/UCLAIS/ml-tutorials-season-5/${commit}/../secret.md`,
    'https://api.github.com/repos/UCLAIS/ml-tutorials-season-5/actions/secrets',
    'https://agentverse.uclai.co.uk/?redirect=http://localhost',
  ])('rejects non-source or traversal URL %s before a request', async input => {
    const fetcher = vi.fn();
    await expect(fetchApproved(input, { fetcher: fetcher as typeof fetch })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses redirects without following even a trusted origin to a private target', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } }));
    await expect(fetchApproved('https://agentverse.uclai.co.uk/', { fetcher: fetcher as typeof fetch })).rejects.toThrow('redirect');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toBeDefined();
  });
  it('enforces both advertised and streamed byte limits', async () => {
    await expect(readBoundedResponse(new Response('tiny', { headers: { 'content-length': '1000' } }), 20)).rejects.toThrow('byte limit');
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(12)); controller.enqueue(new Uint8Array(12)); controller.close(); } });
    await expect(readBoundedResponse(new Response(stream), 20)).rejects.toThrow('byte limit');
  });
  it('bounds HTTP gzip decompression even when the advertised compressed body is small', async () => {
    const wire = new Uint8Array(gzipSync(new Uint8Array(128 * 1024)));
    expect(wire.byteLength).toBeLessThan(4096);
    const decoded = new Response(wire).body!.pipeThrough(new DecompressionStream('gzip'));
    await expect(readBoundedResponse(new Response(decoded, { headers: { 'content-length': String(wire.length), 'content-encoding': 'gzip' } }), 4096)).rejects.toThrow('byte limit');
  });
  it('rejects malformed UTF-8 and binary inputs', () => {
    expect(() => decodeText(Uint8Array.of(0xff))).toThrow();
    expect(() => decodeText(Uint8Array.of(0))).toThrow('Binary');
  });
});

describe('filesystem containment', () => {
  it.each(['../secret', 'folder/../../secret', '/etc/passwd', 'folder\\secret', 'x/%2e%2e/y', 'x/\0y', '.git/config', 'x//y'])('rejects unsafe repository path %s', filename => {
    expect(() => validateRepositoryPath(filename)).toThrow('Unsafe');
  });
  it('rejects a source symlink that escapes the repository', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'uclais-import-test-'));
    temporaryDirectories.push(directory);
    const root = path.join(directory, 'repository'); await mkdir(root);
    await writeFile(path.join(directory, 'secret'), 'never import');
    await symlink(path.join(directory, 'secret'), path.join(root, 'lesson.md'));
    await expect(containedPath(root, 'lesson.md')).rejects.toThrow('escapes');
  });
});

describe('passive teaching parsers', () => {
  it('preserves notebook cell order and code while dropping output payloads', () => {
    const input = JSON.stringify({ nbformat: 4, cells: [
      { cell_type: 'markdown', source: ['# Python lesson\n', 'Understand variables.'] },
      { cell_type: 'code', source: ['import os\n', 'os.system("never-execute-me")'], outputs: [{ text: ['PRIVATE OUTPUT PAYLOAD'] }] },
      { cell_type: 'markdown', source: '## Exercise\nTry it yourself.' },
    ] });
    const parsed = parseNotebook(input, 'lesson.ipynb');
    expect(parsed.sections.map(section => section.id)).toEqual(['cell-1', 'cell-2', 'cell-3']);
    expect(parsed.sections[1].text).toContain('os.system("never-execute-me")');
    expect(parsed.sections[2].kind).toBe('exercise');
    expect(parsed.text).not.toContain('PRIVATE OUTPUT');
  });
  it('labels solutions and refuses hostile notebook shapes or oversize files', () => {
    expect(parseNotebook(JSON.stringify({ cells: [{ cell_type: 'markdown', source: '# Answer\n42' }] }), 'solutions.ipynb').sections[0].kind).toBe('solution');
    expect(() => parseNotebook('{"cells":[{"cell_type":"code","source":{"toString":"payload"}}]}', 'x')).toThrow('source');
    expect(() => parseNotebook('x'.repeat(MAX_SOURCE_BYTES + 1), 'x')).toThrow('byte limit');
  });
  it('parses MDX syntax as text without executing embedded JavaScript', () => {
    const sentinel = '__UCLAIS_IMPORT_SIDE_EFFECT__';
    const mdx = `---\ntitle: Safe lesson\n---\nimport x from 'node:fs'\n# Intro\n{globalThis.${sentinel} = true}\n<Component />\nRead the lesson.`;
    const parsed = parseMarkdown(mdx, 'fallback');
    expect(parsed.title).toBe('Safe lesson');
    expect(parsed.text).toContain('Read the lesson');
    expect((globalThis as Record<string, unknown>)[sentinel]).toBeUndefined();
  });
  it('extracts JSX copy and data literals without invoking source imports or calls', () => {
    const source = `import fs from 'node:fs'; globalThis.__UCLAIS_IMPORT_SIDE_EFFECT__ = true; export default () => <Page title="Society"><h1>Welcome</h1><a href="mailto:info@uclai.co.uk">Contact</a>{dangerous()}</Page>;`;
    const parsed = parseReactCopy(source, 'Society');
    expect(parsed.text).toContain('Welcome');
    expect(parsed.text).toContain('mailto:info@uclai.co.uk');
    expect(parsed.text).not.toContain('dangerous');
    expect((globalThis as Record<string, unknown>).__UCLAIS_IMPORT_SIDE_EFFECT__).toBeUndefined();
  });
  it('does not include executable HTML or style text', () => {
    const parsed = parseHtmlCopy('<main><h1>FAQs</h1><script>stealCredentials()</script><style>.secret{}</style><p>Teams have 3–5 people.</p></main>', 'FAQs');
    expect(parsed.text).toContain('Teams have 3–5 people.');
    expect(parsed.text).not.toContain('stealCredentials');
    expect(parsed.text).not.toContain('.secret');
  });
  it('retains source links including local PDF syntax without fetching them', () => {
    expect(discoverLinks('[slides](pathname:///jc/slides.pdf) [malicious](http://127.0.0.1/private)')).toEqual(['http://127.0.0.1/private', 'https://uclai.co.uk/jc/slides.pdf']);
  });
});

describe('publication boundary', () => {
  it('keeps unapproved imported bodies and learning steps out of the public snapshot', () => {
    const makeDoc = (id: string, status: 'approved' | 'review-required') => ({ id, title: id, text: id === 'pending' ? 'RIGHTS REVIEW BODY' : 'Public lesson', type: 'tutorial', topics: [], archived: true, source: { url: 'https://example.com/' + id, status } });
    const corpus: Corpus = { schemaVersion: 1, generatedAt: '2026-10-29T12:00:00Z', documents: [makeDoc('public', 'approved'), makeDoc('pending', 'review-required')], sources: [{ id: 's', url: 'https://example.com/', title: 'Source', kind: 'tutorial', status: 'review-required', documentIds: ['public', 'pending'] }], learningPaths: [{ id: 'path', title: 'Path', description: 'Description', prerequisites: [], steps: [{ documentId: 'pending' }, { documentId: 'public' }] }] };
    const result = publicCorpus(corpus);
    expect(result.documents.map(doc => doc.id)).toEqual(['public']);
    expect(result.sources[0].documentIds).toEqual(['public']);
    expect(result.learningPaths[0].steps).toEqual([{ documentId: 'public' }]);
    expect(JSON.stringify(result)).not.toContain('RIGHTS REVIEW BODY');
    expect(corpus.documents).toHaveLength(2);
  });

  const makeCorpus = (documents: Corpus['documents']): Corpus => ({ schemaVersion: 1, generatedAt: '2026-10-29T12:00:00Z', documents, sources: [], learningPaths: [] });
  const imported = async (id: string, text: string): Promise<Corpus['documents'][number]> => {
    const doc: Corpus['documents'][number] = { id, title: id, text, type: 'tutorial', topics: [], archived: true, source: { url: `https://example.com/${id}`, status: 'approved', license: 'MIT' }, origin: 'imported' };
    doc.importedContentHash = await importedContentHash(doc);
    return doc;
  };
  it('preserves manual corrections even when an older client did not mark them curated', async () => {
    const original = await imported('lesson', 'Original explanation');
    const corrected = { ...original, text: 'Committee correction' };
    const upstream = await imported('lesson', 'Upstream changed explanation');
    const result = await reconcileImport(makeCorpus([corrected]), makeCorpus([upstream]));
    expect(result.corpus.documents[0].text).toBe('Committee correction');
    expect(result.conflicts[0].documentId).toBe('lesson');
    expect(result.preserved).toBe(1);
  });
  it('does not transfer a historical approval over changed source text or licence', async () => {
    const original = await imported('lesson', 'Reviewed content');
    const candidate = await imported('lesson', 'Changed content');
    candidate.source.status = 'review-required';
    candidate.source.license = undefined;
    const result = await reconcileImport(makeCorpus([original]), makeCorpus([candidate]));
    expect(result.corpus.documents[0].source.status).toBe('review-required');
    expect(result.updated).toBe(1);
  });
  it('retains removed upstream documents and requires an explicit delete operation', async () => {
    const original = await imported('lesson', 'Existing explanation');
    const result = await reconcileImport(makeCorpus([original]), makeCorpus([]));
    expect(result.corpus.documents).toHaveLength(1);
    expect(result.conflicts[0].reason).toContain('separate delete');
  });
  it('retains a review for unchanged content without treating revision metadata as text edits', async () => {
    const original = await imported('lesson', 'Unchanged content');
    original.reviewedAt = '2026-10-28T12:00:00Z';
    const candidate = { ...original, source: { ...original.source, status: 'review-required' as const, revision: 'new-source-revision' } };
    const result = await reconcileImport(makeCorpus([original]), makeCorpus([candidate]));
    expect(result.corpus.documents[0].source.status).toBe('approved');
    expect(result.corpus.documents[0].source.revision).toBe('new-source-revision');
    expect(result.unchanged).toBe(1);
  });
  it('does not resurrect deliberately deleted documents or learning path steps during re-import', async () => {
    const candidate = await imported('deleted-lesson', 'Upstream body that must remain withdrawn');
    const retained = await imported('retained-lesson', 'Available explanation');
    const active = { ...makeCorpus([retained]), curatedDeletions: ['deleted-lesson'] };
    const incoming = makeCorpus([candidate, retained]);
    incoming.learningPaths = [{ id: 'path', title: 'Path', description: 'Route', prerequisites: [], steps: [{ documentId: candidate.id }, { documentId: retained.id }] }];
    incoming.sources = [{ id: 'upstream', title: 'Source', url: 'https://example.com/source', kind: 'tutorial', status: 'imported', documentIds: [candidate.id, retained.id] }];
    const result = await reconcileImport(active, incoming);
    expect(result.corpus.documents.map(doc => doc.id)).toEqual(['retained-lesson']);
    expect(result.corpus.curatedDeletions).toEqual(['deleted-lesson']);
    expect(result.corpus.learningPaths[0].steps).toEqual([{ documentId: retained.id }]);
    expect(result.corpus.sources[0].documentIds).toEqual(['retained-lesson']);
    expect(result.conflicts[0].reason).toContain('deliberately deleted');
    expect(JSON.stringify(result.corpus)).not.toContain('Upstream body that must remain withdrawn');
  });
});
