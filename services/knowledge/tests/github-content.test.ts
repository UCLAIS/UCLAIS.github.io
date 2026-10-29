import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { KnowledgeReader } from '../src/core';
import { bundledStore } from '../src/bundled-store';
import { buildGithubKnowledge } from '../src/ingestion/github-content';
import { MAX_SOURCE_BYTES } from '../src/ingestion/security';
import type { Corpus } from '../src/types';

const temporary: string[] = [];
const generatedAt = '2026-10-29T12:00:00.000Z';
const baseline = (): Corpus => ({ schemaVersion: 1, generatedAt, sources: [], learningPaths: [], documents: [{ id: 'archive:lesson', title: 'Archive lesson', text: 'Original archive text.', type: 'tutorial', topics: [], archived: true, source: { url: 'https://uclai.co.uk/tutorial/', status: 'approved' } }] });
async function repository() { const root = await mkdtemp(path.join(os.tmpdir(), 'uclai-github-')); temporary.push(root); await mkdir(path.join(root, 'knowledge/tutorials'), { recursive: true }); return root; }
async function put(root: string, relative: string, text: string) { await mkdir(path.dirname(path.join(root, 'knowledge', relative)), { recursive: true }); await writeFile(path.join(root, 'knowledge', relative), text); }
const build = (root: string, base = baseline()) => buildGithubKnowledge({ repoRoot: root, baseline: base, repository: 'UCLAIS/UCLAIS.github.io', revision: 'a'.repeat(40), generatedAt, outputDirectory: path.join(root, '.generated') });
afterEach(async () => { for (const root of temporary.splice(0)) await rm(root, { force: true, recursive: true }); });

describe('GitHub folder publication', () => {
  it('adds, updates and removes a nested tutorial with deterministic versions and exact commit citations', async () => {
    const root = await repository(); await put(root, 'tutorials/python/week1.md', '# Variables\nA variable names a value.');
    const first = await build(root); expect((await build(root)).release.id).toBe(first.release.id);
    expect(first.website).toMatchObject({ releaseId: first.release.id, materials: [{ collection: 'tutorials', route: '/learn/tutorials/python/week1.md/', sourcePath: 'knowledge/tutorials/python/week1.md', document: { id: 'knowledge:tutorials/python/week1.md' } }] });
    const reader = new KnowledgeReader(bundledStore(first.release), undefined, first.release);
    const hit = (await reader.search('variable')).results[0];
    expect(hit).toMatchObject({ documentId: 'knowledge:tutorials/python/week1.md', archived: true, releaseId: first.release.id });
    expect(hit.source.url).toBe(`https://github.com/UCLAIS/UCLAIS.github.io/blob/${'a'.repeat(40)}/knowledge/tutorials/python/week1.md`);
    expect((await reader.fetch(hit.documentId, hit.sectionId, hit.releaseId)).text).toContain('names a value');
    await put(root, 'tutorials/python/week1.md', '# Variables\nA corrected explanation.');
    const second = await build(root); expect(second.release.id).not.toBe(first.release.id);
    await expect(new KnowledgeReader(bundledStore(second.release), undefined, second.release).fetch(hit.documentId, undefined, first.release.id)).rejects.toMatchObject({ code: 'release_unavailable' });
    await rm(path.join(root, 'knowledge/tutorials/python/week1.md'));
    const removed = await build(root);
    expect(removed.release.corpus.documents.map(doc => doc.id)).toEqual(['archive:lesson']);
    expect(removed.website.materials).toEqual([]);
    expect(JSON.parse(await readFile(path.join(root, '.generated/website-knowledge.json'), 'utf8')).materials).toEqual([]);
  });
  it('records session dates without presenting a session write-up as an upcoming event', async () => {
    const root = await repository(); await put(root, 'nexus/session.md', '---\ntitle: Evaluation lab\ndate: 2026-10-20\ntopics: [evaluation, ai-safety]\nyear: 2026/27\n---\n# Evaluation\nInspect the results.\n## Exercise\nTry it.\n## Hint\nCheck the labels.\n## Solution\nCompare both.');
    const result = await build(root); const doc = result.release.corpus.documents.find(doc => doc.type === 'nexus-session')!;
    expect(doc).toMatchObject({ archived: true, year: '2026/27', topics: ['evaluation', 'ai-safety'] });
    expect(doc.sections!.map(section => section.kind)).toEqual(['explanation', 'explanation', 'exercise', 'hint', 'solution']);
    const reader = new KnowledgeReader(bundledStore(result.release), undefined, result.release);
    expect((await reader.search('2026-10-20')).results.some(hit => hit.documentId === doc.id)).toBe(true);
    expect((await reader.listEvents()).events).toEqual([]);
    expect(result.website.materials).toMatchObject([{ collection: 'nexus', date: '2026-10-20', document: { id: doc.id, sections: doc.sections } }]);
  });
  it('keeps drafts/templates out of both document bodies and the index, and reports unsupported formats', async () => {
    const root = await repository(); await put(root, 'tutorials/draft.md', '---\nstatus: draft\n---\n# DRAFT SENTINEL\nUnreviewed text.');
    await put(root, '_templates/example.md', '# TEMPLATE SENTINEL'); await put(root, 'tutorials/README.md', '# README SENTINEL'); await put(root, 'tutorials/slide.pptx', 'Unsupported slide');
    const result = await build(root); expect(result.report.excludedFiles).toEqual(['knowledge/tutorials/draft.md']); expect(result.report.warnings).toHaveLength(1);
    const snapshot = await readFile(path.join(root, '.generated/knowledge.release.json'), 'utf8'); expect(snapshot).not.toMatch(/DRAFT SENTINEL|TEMPLATE SENTINEL|README SENTINEL/);
    expect(result.website.materials).toEqual([]);
    expect(await readFile(path.join(root, '.generated/website-knowledge.json'), 'utf8')).not.toMatch(/DRAFT SENTINEL|TEMPLATE SENTINEL|README SENTINEL/);
  });
  it('retains ordered notebook cells and sidecar attribution without executing code or retaining outputs', async () => {
    const root = await repository(); await put(root, 'tutorials/cells.ipynb', JSON.stringify({ cells: [{ cell_type: 'markdown', source: '# Notebook lesson\nLearn Python.' }, { cell_type: 'code', source: 'globalThis.__GITHUB_IMPORT_EXECUTED__ = true', outputs: [{ text: 'OUTPUT SENTINEL' }] }, { cell_type: 'markdown', source: '## Hint\nUse a variable.' }, { cell_type: 'markdown', source: '## Solution\nUse x.' }] }));
    await put(root, 'tutorials/cells.meta.json', JSON.stringify({ title: 'Cell lesson', attribution: 'Society teaching team', license: 'MIT' }));
    const result = await build(root); const doc = result.release.corpus.documents.find(doc => doc.title === 'Cell lesson')!;
    expect(doc.sections!.map(section => section.id)).toEqual(['cell-1', 'cell-2', 'cell-3', 'cell-4']);
    expect(doc.sections![1]).toMatchObject({ kind: 'code', locator: 'notebook cell 2 (code)' }); expect(doc.sections![2].kind).toBe('hint'); expect(doc.sections![3].kind).toBe('solution');
    expect(doc.source.attribution).toBe('Society teaching team'); expect(JSON.stringify(result.release)).not.toContain('OUTPUT SENTINEL');
    expect(result.website.materials[0].document.sections).toEqual(doc.sections);
    expect(JSON.stringify(result.website)).not.toContain('OUTPUT SENTINEL');
    expect((globalThis as Record<string, unknown>).__GITHUB_IMPORT_EXECUTED__).toBeUndefined();
  });
  it('treats malicious MDX and external references as inert source data without fetching links', async () => {
    const root = await repository(); await put(root, 'tutorials/inert.mdx', "import fs from 'node:fs'\n# Inert\n{globalThis.__GITHUB_IMPORT_EXECUTED__ = true}\n<script>steal()</script>\n[external](https://127.0.0.1/private)");
    const result = await build(root); expect((globalThis as Record<string, unknown>).__GITHUB_IMPORT_EXECUTED__).toBeUndefined();
    expect(result.release.corpus.sources.find(source => source.url === 'https://127.0.0.1/private')).toMatchObject({ status: 'link-only', documentIds: [] });
    expect(result.release.corpus.documents[1].text).not.toContain('<script>');
  });
  it('keeps code cells under notebook hints and solutions with their teaching context in both outputs', async () => {
    const root = await repository();
    await put(root, 'nexus/teaching.ipynb', JSON.stringify({ cells: [
      { cell_type: 'markdown', source: '# Practice' }, { cell_type: 'code', source: 'practice()' },
      { cell_type: 'markdown', source: '## Hint' }, { cell_type: 'code', source: 'hint()' },
      { cell_type: 'markdown', source: '## Solution' }, { cell_type: 'code', source: 'answer()' },
      { cell_type: 'markdown', source: '## Next exercise' }, { cell_type: 'code', source: 'next_task()' },
    ] }));
    const result = await build(root); const doc = result.website.materials[0].document;
    expect(doc.sections!.map(section => section.kind)).toEqual(['explanation', 'code', 'hint', 'hint', 'solution', 'solution', 'exercise', 'code']);
    expect(doc.sections![5]).toMatchObject({ id: 'cell-6', locator: 'notebook cell 6 (code)', text: '```python\nanswer()\n```' });
    const reader = new KnowledgeReader(bundledStore(result.release), undefined, result.release);
    expect((await reader.fetch(doc.id, 'cell-6')).sections).toEqual([doc.sections![5]]);
  });
  it('applies reviewed overrides while leaving the bootstrap unchanged', async () => {
    const root = await repository(); const base = baseline(); await put(root, 'faqs/correction.md', '---\nid: archive:lesson\n---\n# Correction\nReviewed replacement.');
    const result = await build(root, base); expect(result.release.corpus.documents).toHaveLength(1); expect(result.release.corpus.documents[0].text).toContain('Reviewed replacement'); expect(base.documents[0].text).toBe('Original archive text.');
  });
  it('withdraws bodies and path references, including previously curated deletions and live event IDs', async () => {
    const root = await repository(); await put(root, 'withdrawn.json', JSON.stringify(['archive:lesson', 'luma:hidden']));
    const base = baseline(); base.curatedDeletions = ['historic:removed']; base.learningPaths = [{ id: 'path', title: 'Path', description: 'Study', prerequisites: [], steps: [{ documentId: 'archive:lesson' }] }];
    const result = await build(root, base); expect(result.release.corpus.documents).toEqual([]); expect(result.release.corpus.learningPaths).toEqual([]); expect(JSON.stringify(result.release)).not.toContain('Original archive text.');
    const store = bundledStore(result.release, result.withdrawnDocumentIds); expect(await store.isWithdrawn('historic:removed')).toBe(true); expect(await store.isWithdrawn('luma:hidden')).toBe(true); expect(Object.keys(store).sort()).toEqual(['hasRelease', 'isWithdrawn', 'readActive', 'readRelease']);
  });
  it('withdraws tutorials and Nexus notes from both website listings and MCP search', async () => {
    const root = await repository();
    await put(root, 'tutorials/lesson.md', '# Tutorial sentinel\nA tutorial explanation.');
    await put(root, 'nexus/session.md', '# Nexus sentinel\nA research session explanation.');
    const before = await build(root);
    expect(before.website.materials).toHaveLength(2);
    await put(root, 'withdrawn.json', JSON.stringify(before.website.materials.map(item => item.document.id)));
    const after = await build(root);
    expect(after.website.materials).toEqual([]);
    expect(JSON.stringify({ documents: after.release.corpus.documents, index: after.release.index })).not.toMatch(/Tutorial sentinel|Nexus sentinel/);
    expect((await new KnowledgeReader(bundledStore(after.release), undefined, after.release).search('sentinel')).results).toEqual([]);
  });
  it('uses the recorded series position for website order and exposes it in MCP results', async () => {
    const root = await repository();
    for (const folder of ['tutorials', 'nexus']) {
      await put(root, `${folder}/ten.md`, '---\nyear: 2026/27\nseries: Foundations\norder: 10\ndate: 2026-10-29\n---\n# Tenth lesson\nA later lesson.');
      await put(root, `${folder}/two.md`, '---\nyear: 2026/27\nseries: Foundations\norder: 2\ndate: 2026-10-01\n---\n# Second lesson\nAn earlier lesson.');
    }
    const result = await build(root);
    for (const collection of ['tutorials', 'nexus']) expect(result.website.materials.filter(item => item.collection === collection).map(item => item.document.order)).toEqual([2, 10]);
    const hits = (await new KnowledgeReader(bundledStore(result.release), undefined, result.release).search('Foundations')).results;
    expect(hits).toEqual(expect.arrayContaining([expect.objectContaining({ series: 'Foundations', order: 2 }), expect.objectContaining({ series: 'Foundations', order: 10 })]));
    await put(root, 'tutorials/two.meta.json', JSON.stringify({ series: 'Foundations', order: 3 }));
    expect((await build(root)).website.materials.filter(item => item.collection === 'tutorials').map(item => item.document.order)).toEqual([3, 10]);
  });
  it('rejects duplicate series positions instead of silently choosing a lesson order', async () => {
    const root = await repository();
    for (const file of ['a.md', 'b.md']) await put(root, `tutorials/${file}`, '---\nyear: 2026/27\nseries: Foundations\norder: 2\n---\n# A lesson\nContent.');
    await expect(build(root)).rejects.toThrow('Duplicate lesson/session number');
    await put(root, 'tutorials/b.meta.json', JSON.stringify({ year: '2025/26' }));
    expect((await build(root)).website.materials).toHaveLength(2);
  });
  it.each(['title: !unsafe', 'archived: yes', 'unknown: value', 'title: One\ntitle: Two', 'date: 2026-02-30', 'source: http://localhost/secret', 'source: https://user:password@example.test/', 'order: 1', 'series: Foundations\norder: 0', 'series: Foundations\norder: 1.5', 'series: Foundations\norder: 10001'])('refuses unsafe or malformed metadata: %s', async fields => {
    const root = await repository(); await put(root, 'tutorials/bad.md', `---\n${fields}\n---\n# Lesson\nText.`); await expect(build(root)).rejects.toThrow();
  });
  it('refuses duplicate document IDs and learning paths referencing absent documents', async () => {
    const root = await repository(); for (const filename of ['a.md', 'b.md']) await put(root, `tutorials/${filename}`, '---\nid: duplicate\n---\n# Lesson\nText.');
    await expect(build(root)).rejects.toThrow('same document identifier'); await rm(path.join(root, 'knowledge/tutorials/b.md')); await put(root, 'learning-paths.json', JSON.stringify([{ id: 'path', title: 'Path', description: 'Study', prerequisites: [], steps: [{ documentId: 'absent' }] }])); await expect(build(root)).rejects.toThrow('unknown document');
  });
  it('rejects escaping symlinks and oversized inputs', async () => {
    const root = await repository(); await writeFile(path.join(root, 'private.txt'), 'never import'); await symlink(path.join(root, 'private.txt'), path.join(root, 'knowledge/tutorials/link.md')); await expect(build(root)).rejects.toThrow('Symlinked');
    await rm(path.join(root, 'knowledge/tutorials/link.md')); await put(root, 'tutorials/huge.md', 'x'.repeat(MAX_SOURCE_BYTES + 1)); await expect(build(root)).rejects.toThrow('byte limit');
  });
  it('refuses a symlinked root folder even when its target is inside the repository', async () => {
    const root = await repository(); await rm(path.join(root, 'knowledge'), { recursive: true }); await mkdir(path.join(root, 'elsewhere')); await symlink(path.join(root, 'elsewhere'), path.join(root, 'knowledge')); await expect(build(root)).rejects.toThrow('Symlinked');
  });
  it('refuses a release beyond the bundled size limit instead of enabling paid storage', async () => {
    const root = await repository(); const base = baseline(); const sample = base.documents[0]; base.documents = Array.from({ length: 10 }, (_, i) => ({ ...sample, id: `large:${i}`, text: 'safe '.repeat(190_000) }));
    await expect(build(root, base)).rejects.toThrow('8 MiB safety limit');
  });
  it('rejects credentials even in discarded notebook outputs and does not echo malformed JSON or PDF text', async () => {
    const root = await repository(); const secret = 'ghp_' + 'A'.repeat(40); await put(root, 'tutorials/leak.ipynb', JSON.stringify({ cells: [{ cell_type: 'code', source: 'x = 1', outputs: [{ text: secret }] }] }));
    await expect(build(root)).rejects.toThrow('Credential-like'); await expect(build(root)).rejects.not.toThrow(secret);
    await put(root, 'tutorials/leak.ipynb', '{"SECRET SOURCE FRAGMENT'); await expect(build(root)).rejects.toThrow('Invalid JSON'); await expect(build(root)).rejects.not.toThrow('SECRET SOURCE');
    await rm(path.join(root, 'knowledge/tutorials/leak.ipynb')); await put(root, 'tutorials/bad.pdf', '%PDF-1.3\nSECRET SOURCE FRAGMENT'); await expect(build(root)).rejects.toThrow('parser output was not logged');
  });
});
