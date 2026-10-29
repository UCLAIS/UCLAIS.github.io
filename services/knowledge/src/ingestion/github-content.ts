import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { approvedCorpus, CorpusSchema, makeIndex, validateCorpus } from '../core';
import { containsSensitiveText } from '../content-safety';
import type { Corpus, KnowledgeDocument, Release, SourceRecord } from '../types';
import { containedPath, MAX_PDF_BYTES, MAX_SOURCE_BYTES, validateRepositoryPath } from './security';
import { discoverLinks, parseMarkdown, parseNotebook } from './parse';
import { extractPdf } from './pdf';

export const MAX_BUNDLED_RELEASE_BYTES = 8 * 1024 * 1024;
const identifier = z.string().min(1).max(240).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/).refine(value => !value.split('/').some(part => part === '.' || part === '..'));
const metadataSchema = z.object({
  id: identifier.optional(), title: z.string().min(1).max(500).optional(), type: z.string().min(1).max(80).optional(),
  topics: z.array(z.string().min(1).max(100)).max(100).optional(), year: z.string().max(30).optional(), archived: z.boolean().optional(),
  series: z.string().min(1).max(200).optional(), order: z.number().int().min(1).max(10000).optional(),
  status: z.enum(['published', 'draft', 'review-required']).optional(),
  source: z.string().url().max(2048).refine(value => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }).optional(),
  attribution: z.string().max(2000).optional(), license: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), start: z.string().datetime().optional(), end: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(),
}).strict();
type Metadata = z.infer<typeof metadataSchema>;
export interface GithubContentOptions {
  repoRoot: string;
  baseline: Corpus;
  repository: string;
  revision: string;
  generatedAt: string;
  outputDirectory?: string;
}
export interface GithubBuild {
  release: Release;
  withdrawnDocumentIds: string[];
  website: WebsiteKnowledge;
  report: { documents: number; sections: number; addedFiles: number; excludedFiles: string[]; warnings: string[]; releaseId: string; snapshotBytes: number };
}
export interface WebsiteMaterial {
  collection: 'tutorials' | 'nexus'; route: string; sourcePath: string; fileUrl: string; format: string; date?: string;
  document: KnowledgeDocument;
}
export interface WebsiteKnowledge { schemaVersion: 1; releaseId: string; materials: WebsiteMaterial[] }
function compareWebsiteMaterials(a: WebsiteMaterial, b: WebsiteMaterial): number {
  const group = a.collection.localeCompare(b.collection) || (b.document.year ?? '').localeCompare(a.document.year ?? '', 'en', { numeric: true });
  if (group) return group;
  const first = a.document.series; const second = b.document.series;
  if (first !== second) return first ? second ? first.localeCompare(second, 'en', { numeric: true }) : -1 : 1;
  return (a.document.order ?? 10001) - (b.document.order ?? 10001) || (b.date ?? '').localeCompare(a.date ?? '') || a.document.title.localeCompare(b.document.title, 'en', { numeric: true });
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const encoded = (value: string) => value.split('/').map(encodeURIComponent).join('/');

function json(input: string, label: string): unknown {
  try { return JSON.parse(input); } catch { throw new Error(`Invalid JSON in ${label}; source contents were not logged.`); }
}

/** Deliberately flat front matter: no YAML tags, aliases, objects or execution. */
function frontMatter(input: string): Record<string, unknown> {
  if (!/^---\r?\n/.test(input)) return {};
  const match = input.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match || match[1].length > 16_384) throw new Error('Invalid or oversized Markdown front matter.');
  const values: Record<string, unknown> = Object.create(null);
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*?)\s*$/);
    if (!field || Object.hasOwn(values, field[1])) throw new Error('Use unique, flat key: value metadata fields.');
    const [key, raw] = [field[1], field[2]];
    let value: unknown = raw;
    if (key === 'topics') {
      const list = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
      value = list ? list.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, '')) : [];
    } else if (key === 'order') {
      if (!/^[1-9]\d{0,4}$/.test(raw)) throw new Error('order must be a positive lesson/session number.');
      value = Number(raw);
    } else if (['archived'].includes(key)) {
      if (!['true', 'false'].includes(raw)) throw new Error('archived must be true or false.');
      value = raw === 'true';
    } else if (raw.startsWith('"')) value = json(raw, 'quoted metadata');
    else if (raw.startsWith("'") && raw.endsWith("'")) value = raw.slice(1, -1).replace(/''/g, "'");
    if (typeof value === 'string' && /^(?:[!&*]|[>|]$)/.test(value)) throw new Error('YAML tags, aliases and multiline metadata are not supported.');
    values[key] = value;
  }
  return values;
}

async function textFile(root: string, relative: string, maximum: number): Promise<string> {
  const filename = await containedPath(root, relative);
  if ((await lstat(path.join(root, relative))).isSymbolicLink()) throw new Error('Symlinked knowledge files are refused.');
  if ((await lstat(filename)).size > maximum) throw new Error(`Knowledge file exceeds its byte limit: ${relative}`);
  const bytes = await readFile(filename);
  if (bytes.byteLength > maximum) throw new Error('Knowledge file exceeds its byte limit.');
  const input = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (input.includes('\0')) throw new Error('Binary content is not accepted as text.');
  if (containsSensitiveText(input)) throw new Error(`Credential-like content must be removed from ${relative}; its contents were not logged.`);
  return input;
}

async function optionalJson(root: string, relative: string): Promise<unknown | undefined> {
  try { return json(await textFile(root, relative, 65_536), relative); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

async function files(root: string, relative = 'knowledge'): Promise<string[]> {
  if ((await lstat(path.join(root, relative))).isSymbolicLink()) throw new Error('Symlinked knowledge files or directories are refused.');
  const directory = await containedPath(root, relative);
  const results: string[] = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || entry.name.startsWith('_') || entry.name === 'README.md') continue;
    const child = `${relative}/${entry.name}`;
    validateRepositoryPath(child);
    if (entry.isSymbolicLink()) throw new Error('Symlinked knowledge files or directories are refused.');
    if (entry.isDirectory()) results.push(...await files(root, child));
    else if (entry.isFile()) results.push(child);
    if (results.length > 5000) throw new Error('Knowledge folder exceeds the file limit.');
  }
  return results;
}

function metadata(input: Record<string, unknown>): Metadata {
  const result = metadataSchema.safeParse(input);
  if (!result.success) throw new Error('Invalid content metadata. Check the documented fields and formats; source contents were not logged.');
  if (result.data.order !== undefined && !result.data.series) throw new Error('Lesson/session order needs a series.');
  if (result.data.date && new Date(`${result.data.date}T00:00:00Z`).toISOString().slice(0, 10) !== result.data.date) throw new Error('Invalid session date.');
  if (result.data.end && (!result.data.start || Date.parse(result.data.end) <= Date.parse(result.data.start))) throw new Error('Session end must be after its start.');
  return result.data;
}

/** Build from checked-out public files only. No network crawl or imported code runs. */
export async function buildGithubKnowledge(options: GithubContentOptions): Promise<GithubBuild> {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(options.repository) || !/^[a-f0-9]{40}$/.test(options.revision) || !z.string().datetime().safeParse(options.generatedAt).success) throw new Error('Invalid repository build provenance.');
  const base = approvedCorpus(options.baseline);
  const documents = new Map(base.documents.map(document => [document.id, document]));
  const sources = new Map(base.sources.map(source => [source.id, source]));
  const newIds = new Set<string>(); const excludedFiles: string[] = []; const warnings: string[] = [];
  const websiteMaterials: WebsiteMaterial[] = [];
  let addedFiles = 0;
  for (const relative of await files(options.repoRoot)) {
    if (relative.endsWith('.meta.json') || ['knowledge/learning-paths.json', 'knowledge/withdrawn.json'].includes(relative)) continue;
    const extension = path.extname(relative).toLowerCase();
    if (!['.md', '.mdx', '.ipynb', '.pdf', '.py'].includes(extension)) { warnings.push(`Unsupported file retained in GitHub but excluded from retrieval: ${relative}`); continue; }
    let parsed: { title: string; text: string; sections: NonNullable<KnowledgeDocument['sections']> };
    const raw = extension === '.pdf' ? undefined : await textFile(options.repoRoot, relative, MAX_SOURCE_BYTES);
    const sidecar = await optionalJson(options.repoRoot, relative.replace(/\.[^.]+$/, '.meta.json'));
    if (sidecar !== undefined && (!sidecar || typeof sidecar !== 'object' || Array.isArray(sidecar))) throw new Error('Metadata sidecars must be JSON objects.');
    const meta = metadata({ ...(raw && ['.md', '.mdx'].includes(extension) ? frontMatter(raw) : {}), ...(sidecar as Record<string, unknown> | undefined) });
    if (meta.status === 'draft' || meta.status === 'review-required') { excludedFiles.push(relative); continue; }
    const fallback = path.basename(relative, extension).replace(/[_-]/g, ' ');
    if (extension === '.pdf') {
      const filename = await containedPath(options.repoRoot, relative);
      if ((await lstat(filename)).size > MAX_PDF_BYTES) throw new Error('PDF exceeds its byte limit.');
      try { parsed = await extractPdf(filename, meta.title || fallback); }
      catch { throw new Error(`PDF extraction failed for ${relative}; parser output was not logged. Supply a supported PDF or text export.`); }
    } else if (extension === '.ipynb') { json(raw!, relative); parsed = parseNotebook(raw!, path.basename(relative)); }
    else if (extension === '.py') parsed = { title: fallback, text: raw!, sections: [{ id: 'code', heading: fallback, text: raw!, kind: 'code', locator: 'source file' }] };
    else parsed = parseMarkdown(raw!, fallback);
    if (!parsed.text.trim()) throw new Error(`Knowledge file contains no extractable content: ${relative}`);
    const slug = relative.slice('knowledge/'.length).toLowerCase().replace(/[^a-z0-9._/-]+/g, '-');
    const id = meta.id ?? `knowledge:${slug}`;
    if (newIds.has(id)) throw new Error('Two knowledge files use the same document identifier.');
    if (documents.has(id) && !meta.id) throw new Error('Generated document identifier collides with an existing source; specify a unique id.');
    newIds.add(id);
    const folder = relative.split('/')[1];
    const type = meta.type ?? ({ tutorials: 'tutorial', nexus: 'nexus-session', faqs: 'faq', guides: 'guide' }[folder] ?? 'material');
    const sourceUrl = meta.source ?? `https://github.com/${options.repository}/blob/${options.revision}/${encoded(relative)}`;
    const document: KnowledgeDocument = {
      id, title: meta.title ?? parsed.title, text: meta.date ? `Session date: ${meta.date}\n\n${parsed.text}` : parsed.text, sections: meta.date ? [{ id: 'session-date', heading: 'Session date', text: meta.date, kind: 'explanation', locator: 'session metadata' }, ...parsed.sections] : parsed.sections,
      type, topics: meta.topics ?? [folder], year: meta.year, series: meta.series, order: meta.order, archived: meta.archived ?? (meta.start ? false : ['tutorial', 'tutorial-solution', 'nexus-session'].includes(type)),
      origin: 'curated', reviewedAt: options.generatedAt, expiresAt: meta.expiresAt ?? meta.end ?? meta.start,
      source: { url: sourceUrl, revision: options.revision, attribution: meta.attribution ?? 'UCL AI Society; maintained and reviewed through its GitHub repository.', license: meta.license, status: 'approved' },
      ...(meta.start ? { event: { start: meta.start, end: meta.end, timezone: 'UTC', registrationUrl: sourceUrl } } : {}),
    };
    documents.set(id, document); addedFiles++;
    if (folder === 'tutorials' || folder === 'nexus') websiteMaterials.push({ collection: folder, route: `/learn/${encoded(relative.slice('knowledge/'.length))}/`, sourcePath: relative, fileUrl: `https://github.com/${options.repository}/blob/${options.revision}/${encoded(relative)}`, format: extension.slice(1), date: meta.date ?? meta.start?.slice(0, 10), document });
    const recordId = `github:${hash(relative).slice(0, 24)}`;
    sources.set(recordId, { id: recordId, url: sourceUrl, title: document.title, kind: type, status: 'imported', revision: options.revision, year: meta.year, license: meta.license, attribution: document.source.attribution, documentIds: [id] });
    for (const link of discoverLinks(document.text)) {
      const url = new URL(link); if (url.protocol !== 'https:') continue;
      const linkId = `source:${hash(url.href).slice(0, 24)}`;
      if (!sources.has(linkId)) sources.set(linkId, { id: linkId, url: url.href, title: url.href, kind: 'external-reference', status: 'link-only', reason: 'Linked from a GitHub knowledge file; the external body has not been imported.', documentIds: [] });
    }
  }
  const withdrawalInput = await optionalJson(options.repoRoot, 'knowledge/withdrawn.json') ?? [];
  const withdrawnDocumentIds = [...new Set([...(base.curatedDeletions ?? []), ...z.array(identifier).max(5000).parse(withdrawalInput)])].sort();
  const withdrawn = new Set(withdrawnDocumentIds);
  const available = new Set([...documents.keys()].filter(id => !withdrawn.has(id)));
  const pathsInput = await optionalJson(options.repoRoot, 'knowledge/learning-paths.json') ?? [];
  const extraPaths = CorpusSchema.shape.learningPaths.parse(pathsInput);
  const paths = [...new Map([...base.learningPaths, ...extraPaths].map(item => [item.id, item])).values()];
  for (const learningPath of extraPaths) for (const step of learningPath.steps) if (!documents.has(step.documentId)) throw new Error('Learning path references an unknown document.');
  const corpus: Corpus = { ...base, generatedAt: options.generatedAt, documents: [...documents.values()].filter(document => available.has(document.id)).sort((a, b) => a.id.localeCompare(b.id)), sources: [...sources.values()].map(source => ({ ...source, documentIds: source.documentIds.filter(id => available.has(id)) })).sort((a, b) => a.id.localeCompare(b.id)), learningPaths: paths.map(item => ({ ...item, steps: item.steps.filter(step => available.has(step.documentId)) })).filter(item => item.steps.length > 0), curatedDeletions: [...new Set([...(base.curatedDeletions ?? []), ...withdrawnDocumentIds])] };
  if (!validateCorpus(corpus).valid) throw new Error('Knowledge validation failed. Check document sizes, duplicate identifiers, metadata and credential-like content; source contents were not logged.');
  const releaseId = hash(JSON.stringify(corpus));
  const website: WebsiteKnowledge = { schemaVersion: 1, releaseId, materials: websiteMaterials.filter(item => available.has(item.document.id)).sort(compareWebsiteMaterials) };
  const positions = new Set<string>();
  for (const item of website.materials) if (item.document.order !== undefined) {
    const position = JSON.stringify([item.collection, item.document.year ?? '', item.document.series, item.document.order]);
    if (positions.has(position)) throw new Error('Duplicate lesson/session number within an academic year and series. Review the existing records before assigning a position.');
    positions.add(position);
  }
  const release: Release = { id: releaseId, hash: releaseId, createdAt: options.generatedAt, previousReleaseId: null, operationId: releaseId, corpus, index: makeIndex(corpus).toJSON() };
  const snapshot = JSON.stringify({ release, withdrawnDocumentIds });
  const snapshotBytes = Buffer.byteLength(snapshot);
  if (snapshotBytes > MAX_BUNDLED_RELEASE_BYTES) throw new Error('Bundled knowledge exceeds the 8 MiB safety limit. Split or optimise the content before deploying; paid upgrades are not enabled automatically.');
  const report = { documents: corpus.documents.length, sections: corpus.documents.reduce((count, document) => count + (document.sections?.length || 1), 0), addedFiles, excludedFiles, warnings, releaseId, snapshotBytes };
  if (options.outputDirectory) {
    await mkdir(options.outputDirectory, { recursive: true });
    await writeFile(path.join(options.outputDirectory, 'knowledge.release.json'), snapshot + '\n');
    await writeFile(path.join(options.outputDirectory, 'website-knowledge.json'), JSON.stringify(website) + '\n');
    await writeFile(path.join(options.outputDirectory, 'build-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  return { release, withdrawnDocumentIds, website, report };
}
