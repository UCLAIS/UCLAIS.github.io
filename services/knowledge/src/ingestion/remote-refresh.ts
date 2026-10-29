import { KnowledgeError, type Corpus, type KnowledgeDocument, type SourceRecord } from '../types.js';
import { parseMarkdown, parseNotebook } from './parse.js';
import { importedContentHash } from './reconcile.js';
import { redactDocument } from '../content-safety.js';

const repositories: Record<string, { branch: string; year: string }> = {
  'Machine-Learning-Tutorials': { branch: 'master', year: '2020/21' },
  'ML-Tutorials-Season-2': { branch: 'main', year: '2021/22' },
  'ml-tutorials-season-3': { branch: 'main', year: '2022/23' },
  'ml-tutorials-season-4': { branch: 'main', year: '2023/24' },
  'ml-tutorials-season-5': { branch: 'main', year: '2024/25' },
};
const NOTEBOOK_BYTES = 4 * 1024 * 1024;
const TREE_BYTES = 2 * 1024 * 1024;
type TreeEntry = { path: string; type: string; mode: string; sha: string; size: number };
type Target = { repo: string; path: string; source: SourceRecord; document: KnowledgeDocument };

function safePath(value: string): boolean {
  return !!value && !value.startsWith('/') && !/[\\%\x00-\x1f\x7f]/.test(value) && value.split('/').every(part => part && part !== '.' && part !== '..' && part !== '.git');
}
function encodedPath(value: string): string { return value.split('/').map(encodeURIComponent).join('/'); }
function reason(error: unknown): string { return (error instanceof Error ? error.message : String(error)).slice(0, 500); }

function resolveTarget(active: Corpus, source: SourceRecord): Target {
  if (source.documentIds.length !== 1) throw new Error('Select a canonical source containing exactly one document. Use the offline importer for repositories and folders.');
  const url = new URL(source.url);
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port || url.search || url.hash) throw new Error('Only registered canonical GitHub blob sources can be refreshed. Use the offline importer and inspect its report for PDFs, Canva, recordings and other sources.');
  const match = url.pathname.match(/^\/UCLAIS\/([^/]+)\/blob\/([a-f0-9]{40})\/(.+)$/);
  if (!match || !Object.hasOwn(repositories, match[1])) throw new Error('Source is outside the five approved UCLAIS tutorial repositories or is not a pinned canonical blob.');
  const relative = decodeURIComponent(match[3]);
  if (!safePath(relative)) throw new Error('Unsafe source path');
  if (!/\.(ipynb|md|py)$/i.test(relative)) throw new Error('This format requires the offline importer. Inspect its import report; remote refresh supports notebooks, Markdown and teaching Python only.');
  const document = active.documents.find(doc => doc.id === source.documentIds[0]);
  if (!document) throw new Error('The registered source document is absent. Inspect the import report before refreshing.');
  return { repo: match[1], path: relative, source, document };
}

async function download(url: string, network: typeof fetch, maximum: number): Promise<Uint8Array> {
  // This function is private; its callers construct every URL from fixed hosts,
  // allowlisted repository names, checked commit hashes and registered paths.
  const response = await network(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/vnd.github+json, text/plain', 'User-Agent': 'UCLAIS-Knowledge-Refresh/1.0' } });
  if (response.status >= 300 && response.status < 400) { await response.body?.cancel(); throw new Error('Source redirect refused'); }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Source returned HTTP ${response.status}; inspect the import report.`); }
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw new Error('Source exceeds the remote refresh byte limit; use the offline importer.'); }
  if (!response.body) throw new Error('Source response has no body');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > maximum) throw new Error('Source exceeds the remote refresh byte limit; use the offline importer.');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  finally { reader.releaseLock(); }
  const result = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

function text(bytes: Uint8Array): string {
  const result = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (result.includes('\0')) throw new Error('Binary source refused');
  return result;
}

async function verifiedBlob(url: string, entry: TreeEntry, network: typeof fetch, maximum: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > maximum) throw new Error('Source exceeds the remote refresh byte limit; use the offline importer.');
  if (entry.mode === '120000' || entry.type !== 'blob' || !/^[a-f0-9]{40}$/.test(entry.sha)) throw new Error('Repository symlink or invalid blob refused');
  const bytes = await download(url, network, maximum);
  if (bytes.length !== entry.size) throw new Error('Pinned source size mismatch');
  const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const input = new Uint8Array(header.length + bytes.length); input.set(header); input.set(bytes, header.length);
  const digest = await crypto.subtle.digest('SHA-1', input);
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== entry.sha) throw new Error('Pinned source Git blob hash mismatch');
  return bytes;
}

/** A maintenance batch stages at most five already-registered teaching sources. */
export async function refreshSources(active: Corpus, sourceIds: string[], network: typeof fetch = fetch): Promise<Corpus> {
  if (!Array.isArray(sourceIds) || !sourceIds.length || sourceIds.length > 5 || sourceIds.some(id => typeof id !== 'string') || new Set(sourceIds).size !== sourceIds.length) throw new KnowledgeError('INVALID_SOURCE_BATCH', 'Select one to five distinct source IDs.');
  const selected = sourceIds.map(id => {
    const source = active.sources.find(item => item.id === id);
    if (!source) throw new KnowledgeError('UNKNOWN_SOURCE', 'Source ID is not in the active approved source registry.');
    return source;
  });
  const documents: KnowledgeDocument[] = []; const sources: SourceRecord[] = [];
  const metadata = new Map<string, Promise<{ revision: string; entries: TreeEntry[]; license?: string }>>();
  const repoMetadata = (repo: string) => {
    if (!metadata.has(repo)) metadata.set(repo, (async () => {
      const commit = JSON.parse(text(await download(`https://api.github.com/repos/UCLAIS/${repo}/commits/${repositories[repo].branch}`, network, 1024 * 1024)));
      if (typeof commit.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('Invalid commit response');
      const tree = JSON.parse(text(await download(`https://api.github.com/repos/UCLAIS/${repo}/git/trees/${commit.sha}?recursive=1`, network, TREE_BYTES)));
      if (!Array.isArray(tree.tree) || tree.truncated || tree.tree.length > 10_000) throw new Error('Incomplete or oversized repository tree');
      const entries: TreeEntry[] = tree.tree;
      const licenceEntry = entries.find(entry => /^licen[cs]e(?:\.md|\.txt)?$/i.test(entry.path));
      let license: string | undefined;
      if (licenceEntry) {
        const licenceText = text(await verifiedBlob(`https://raw.githubusercontent.com/UCLAIS/${repo}/${commit.sha}/${encodedPath(licenceEntry.path)}`, licenceEntry, network, 256 * 1024));
        if (/^MIT License/m.test(licenceText) && /Permission is hereby granted/.test(licenceText)) license = 'MIT';
      }
      return { revision: commit.sha as string, entries, license };
    })());
    return metadata.get(repo)!;
  };
  // Sequential source parsing caps Worker memory; repository metadata requests
  // are cached within the batch, and no other discovered URL is followed.
  for (const source of selected) {
    try {
      const target = resolveTarget(active, source);
      const latest = await repoMetadata(target.repo);
      const entry = latest.entries.find(item => item.path === target.path);
      if (!entry) throw new Error('Registered file is absent from the latest approved branch. Deliberate removal requires publisher review.');
      const bytes = await verifiedBlob(`https://raw.githubusercontent.com/UCLAIS/${target.repo}/${latest.revision}/${encodedPath(target.path)}`, entry, network, NOTEBOOK_BYTES);
      const input = text(bytes);
      let parsed: { title: string; text: string; sections: NonNullable<KnowledgeDocument['sections']> }; let type = target.document.type;
      if (/\.ipynb$/i.test(target.path)) { const notebook = parseNotebook(input, target.path.split('/').pop()!); parsed = notebook; type = notebook.type; }
      else if (/\.md$/i.test(target.path)) parsed = parseMarkdown(input, target.document.title);
      else parsed = { title: target.document.title, text: `\`\`\`python\n${input}\n\`\`\``, sections: [{ id: 'code', heading: target.document.title, text: input, kind: 'code' }] };
      if (!parsed.text.trim()) throw new Error('Source contains no teaching text');
      const approved = target.document.source.status === 'approved' && source.license === 'MIT' && target.document.source.license === 'MIT' && latest.license === 'MIT';
      const url = `https://github.com/UCLAIS/${target.repo}/blob/${latest.revision}/${encodedPath(target.path)}`;
      const { document, redacted } = redactDocument({ ...structuredClone(target.document), ...parsed, id: target.document.id, type, origin: 'imported', source: { ...target.document.source, url, revision: latest.revision, license: latest.license, status: approved ? 'approved' : 'review-required' } });
      delete document.reviewedAt;
      document.importedContentHash = await importedContentHash(document);
      documents.push(document);
      sources.push({ ...structuredClone(source), url, revision: latest.revision, license: latest.license, status: approved ? 'imported' : 'review-required', documentIds: [document.id], reason: `${redacted ? 'Credential-like text was redacted; verify the teaching example. ' : ''}${approved ? 'Refreshed from the latest allowlisted branch; pinned Git blob hash and MIT licence verified. This is a staged import, not a publication.' : 'Refreshed and hash-verified; absent or changed licence facts, or existing pending approval, require publisher review. This is a staged import, not a publication.'}` });
    } catch (error) { sources.push({ ...structuredClone(source), status: 'blocked', documentIds: [], reason: reason(error) }); }
  }
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), documents, sources, learningPaths: [] };
}
