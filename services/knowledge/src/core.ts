import MiniSearch from 'minisearch';
import { z } from 'zod';
import type { Corpus, KnowledgeDocument, Release, SearchFilters, ValidationResult } from './types';
import { KnowledgeError } from './types';
import type { PublishedReader } from './storage';
import type { LumaCalendar } from './luma';
import { containsSensitiveText } from './content-safety';

const identifier = z.string().min(1).max(240).regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/).refine(x => !x.split('/').some(segment => segment === '..' || segment === '.'));
const httpsUrl = z.string().url().max(2048).refine(value => new URL(value).protocol === 'https:', 'Sources must use HTTPS.');
export const DocumentSchema = z.object({
  id: identifier, title: z.string().min(1).max(500), text: z.string().max(2_000_000), type: z.string().min(1).max(80),
  topics: z.array(z.string().max(100)).max(100), year: z.string().max(30).optional(), archived: z.boolean(),
  series: z.string().min(1).max(200).optional(), order: z.number().int().min(1).max(10000).optional(),
  origin: z.enum(['imported', 'curated']).optional(), importedContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  source: z.object({ url: httpsUrl, revision: z.string().max(200).optional(), attribution: z.string().max(2000).optional(), license: z.string().max(200).optional(), status: z.enum(['approved', 'review-required']) }),
  sections: z.array(z.object({ id: identifier, heading: z.string().max(500), text: z.string().max(1_000_000), kind: z.enum(['explanation', 'code', 'exercise', 'hint', 'solution']).optional(), locator: z.string().max(200).optional() })).max(2000).optional(),
  reviewedAt: z.string().datetime().optional(), expiresAt: z.string().datetime().optional(),
  event: z.object({ start: z.string().datetime(), end: z.string().datetime().optional(), timezone: z.string().max(100).optional(), registrationUrl: httpsUrl.optional() }).optional(),
});
export const CorpusSchema = z.object({
  schemaVersion: z.literal(1), generatedAt: z.string().datetime(), documents: z.array(DocumentSchema).max(5000),
  curatedDeletions: z.array(identifier).max(5000).optional(),
  sources: z.array(z.object({ id: identifier, url: httpsUrl, title: z.string().max(500), kind: z.string().max(100), status: z.enum(['imported', 'link-only', 'blocked', 'missing', 'review-required']), reason: z.string().max(3000).optional(), revision: z.string().max(200).optional(), year: z.string().max(30).optional(), license: z.string().max(200).optional(), attribution: z.string().max(2000).optional(), documentIds: z.array(identifier).max(5000) })).max(10000),
  learningPaths: z.array(z.object({ id: identifier, title: z.string().min(1).max(500), description: z.string().max(4000), prerequisites: z.array(z.string().max(1000)).max(100), steps: z.array(z.object({ documentId: identifier, note: z.string().max(2000).optional() })).max(500) })).max(100),
});
export function validateCorpus(corpus: Corpus): ValidationResult {
  const parsed = CorpusSchema.safeParse(corpus);
  if (!parsed.success) return { valid: false, errors: parsed.error.issues.map(x => `${x.path.join('.')}: ${x.message}`), warnings: [] };
  const errors: string[] = []; const warnings: string[] = []; const ids = new Set<string>();
  for (const [position, document] of corpus.documents.entries()) {
    if (document.order !== undefined && !document.series) errors.push(`Lesson/session order needs a series: ${document.id}`);
    if (containsSensitiveText(JSON.stringify(document))) errors.push(`Credential-like content must be removed from document at position ${position}.`);
    if (ids.has(document.id)) errors.push(`Duplicate document: ${document.id}`); ids.add(document.id);
    if (document.source.status !== 'approved') warnings.push(`Excluded pending review: ${document.id}`);
    const sections = new Set<string>();
    for (const section of document.sections ?? []) { if (sections.has(section.id)) errors.push(`Duplicate section in ${document.id}: ${section.id}`); sections.add(section.id); }
  }
  if (containsSensitiveText(JSON.stringify({ sources: corpus.sources, learningPaths: corpus.learningPaths }))) errors.push('Credential-like content must be removed from source metadata or learning paths.');
  const sourceIds = new Set<string>(); for (const source of corpus.sources) { if (sourceIds.has(source.id)) errors.push(`Duplicate source: ${source.id}`); sourceIds.add(source.id); }
  const paths = new Set<string>();
  for (const path of corpus.learningPaths) { if (paths.has(path.id)) errors.push(`Duplicate learning path: ${path.id}`); paths.add(path.id); for (const step of path.steps) if (!ids.has(step.documentId)) errors.push(`Missing path document: ${step.documentId}`); }
  return { valid: errors.length === 0, errors, warnings };
}
export function approvedCorpus(corpus: Corpus): Corpus {
  const result = validateCorpus(corpus); if (!result.valid) throw new KnowledgeError('invalid_corpus', result.errors.slice(0, 10).join('; '));
  const documents = corpus.documents.filter(x => x.source.status === 'approved'); const ids = new Set(documents.map(x => x.id));
  return { ...structuredClone(corpus), documents, learningPaths: corpus.learningPaths.map(x => ({ ...x, steps: x.steps.filter(step => ids.has(step.documentId)) })).filter(x => x.steps.length > 0) };
}
export function makeIndex(corpus: Corpus) {
  const index = new MiniSearch({ fields: ['title', 'text', 'topics'], storeFields: ['documentId', 'sectionId', 'heading'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 } });
  index.addAll(corpus.documents.flatMap(doc => {
    const sections = doc.sections?.length ? doc.sections : [{ id: 'body', heading: doc.title, text: doc.text }];
    return sections.map((section, i) => ({ id: `${doc.id}#${i}`, documentId: doc.id, sectionId: section.id, heading: section.heading, title: `${doc.series ?? ''} ${doc.title} ${section.heading}`, text: section.text, topics: doc.topics.join(' ') }));
  }));
  return index;
}

export class KnowledgeReader {
  private cache = new Map<string, { release: Release; index: MiniSearch }>();
  constructor(private store: PublishedReader, private calendar?: Pick<LumaCalendar, 'listEvents'>, initialRelease?: Release) {
    // A GitHub-built immutable release can be loaded during Worker startup,
    // rather than deserialising its full index during the first HTTP request.
    if (initialRelease) this.cache.set(initialRelease.id, { release: initialRelease, index: MiniSearch.loadJS(initialRelease.index as ReturnType<MiniSearch['toJSON']>, { fields: ['title', 'text', 'topics'], storeFields: ['documentId', 'sectionId', 'heading'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 } }) });
  }
  async snapshot(releaseId?: string) {
    const { pointer } = await this.store.readActive();
    if (!pointer) throw new KnowledgeError('not_published', 'Knowledge has not been published yet.', 503);
    const id = releaseId ?? pointer.releaseId;
    let entry = this.cache.get(id);
    // Active immutable releases can be cached; old versions need a fresh existence check
    // because emergency withdrawal removes historical snapshots too.
    if (entry && id === pointer.releaseId) return entry;
    if (entry && this.store.hasRelease) {
      if (await this.store.hasRelease(id)) return entry;
      this.cache.delete(id); throw new KnowledgeError('release_unavailable', 'This release is unavailable or has been withdrawn.', 404);
    }
    const release = await this.store.readRelease(id);
    if (!release) { this.cache.delete(id); throw new KnowledgeError('release_unavailable', 'This release is unavailable or has been withdrawn.', 404); }
    if (!entry) { entry = { release, index: MiniSearch.loadJS(release.index as ReturnType<MiniSearch['toJSON']>, { fields: ['title', 'text', 'topics'], storeFields: ['documentId', 'sectionId', 'heading'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 } }) }; this.cache.set(id, entry); if (this.cache.size > 2) this.cache.delete(this.cache.keys().next().value!); }
    return entry;
  }
  async search(query: string, filters: SearchFilters = {}, limit = 8) {
    if (!query.trim() || query.length > 500 || !Number.isInteger(limit) || limit < 1 || limit > 20) throw new KnowledgeError('invalid_query', 'Use a query of 1–500 characters and a limit of 1–20.');
    const { release, index } = await this.snapshot(); const docs = new Map(release.corpus.documents.map(x => [x.id, x]));
    const results = [];
    for (const match of index.search(query)) {
      const doc = docs.get(match.documentId as string); if (!doc || (doc.expiresAt && Date.parse(doc.expiresAt) <= Date.now()) || (filters.type && doc.type !== filters.type) || (filters.year && doc.year !== filters.year) || (filters.topic && !doc.topics.includes(filters.topic)) || (filters.archived !== undefined && doc.archived !== filters.archived) || await this.store.isWithdrawn(doc.id)) continue;
      const section = doc.sections?.find(x => x.id === match.sectionId);
      results.push({ documentId: doc.id, sectionId: match.sectionId, title: doc.title, heading: match.heading, excerpt: (section?.text ?? doc.text).slice(0, 1600), source: doc.source, year: doc.year, series: doc.series, order: doc.order, archived: doc.archived, reviewedAt: doc.reviewedAt, expiresAt: doc.expiresAt, score: match.score, releaseId: release.id });
      if (results.length >= limit) break;
    }
    const terms = query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(term => term.length >= 3);
    const sourceGaps = release.corpus.sources.filter(source => source.status !== 'imported' && (!filters.year || source.year === filters.year))
      .map(source => ({ source, score: terms.reduce((score, term) => score + (source.title.toLowerCase().includes(term) ? 3 : source.url.toLowerCase().includes(term) ? 1 : 0), 0) }))
      .filter(match => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map(match => match.source);
    return { releaseId: release.id, generatedAt: release.corpus.generatedAt, results, sourceGaps };
  }
  async fetch(id: string, sectionId?: string, releaseId?: string) {
    if (!identifier.safeParse(id).success) throw new KnowledgeError('invalid_id', 'Invalid resource identifier.');
    const { release } = await this.snapshot(releaseId);
    const doc = release.corpus.documents.find(x => x.id === id);
    if (!doc || await this.store.isWithdrawn(id)) throw new KnowledgeError('not_found', 'Resource not found.', 404);
    const freshness = doc.expiresAt && Date.parse(doc.expiresAt) <= Date.now() ? 'expired' : doc.archived ? 'archived' : 'published';
    const warning = freshness === 'expired' ? 'This snapshot has expired. Do not use it to establish current application status, availability or dates.' : undefined;
    const sourceGaps = release.corpus.sources.filter(source => source.status !== 'imported' && (source.documentIds.includes(id) || doc.text.includes(source.url)));
    if (sectionId) { const section = doc.sections?.find(x => x.id === sectionId); if (!section) throw new KnowledgeError('not_found', 'Section not found.', 404); return { ...doc, text: section.text, sections: [section], releaseId: release.id, freshness, warning, sourceGaps }; }
    return { ...doc, releaseId: release.id, freshness, warning, sourceGaps };
  }
  async listLearningPaths() { const { release } = await this.snapshot(); return { releaseId: release.id, paths: release.corpus.learningPaths }; }
  async getLearningPath(id: string) { const { release } = await this.snapshot(); const path = release.corpus.learningPaths.find(x => x.id === id); if (!path) throw new KnowledgeError('not_found', 'Learning path not found.', 404); return { ...path, releaseId: release.id }; }
  async listEvents(now = new Date()) {
    const { release } = await this.snapshot(); const events: KnowledgeDocument[] = [];
    for (const document of release.corpus.documents) if (document.event && !document.archived && Date.parse(document.event.end ?? document.event.start) >= now.getTime() && (!document.expiresAt || Date.parse(document.expiresAt) >= now.getTime()) && !await this.store.isWithdrawn(document.id)) events.push(document);
    const sourceGaps = release.corpus.sources.filter(x => /event|calendar/.test(x.kind) && x.status !== 'imported');
    if (!this.calendar) return { releaseId: release.id, generatedAt: release.corpus.generatedAt, events: events.sort((a, b) => Date.parse(a.event!.start) - Date.parse(b.event!.start)), sourceGaps };
    const live = await this.calendar.listEvents(now);
    for (const event of live.events) if (!await this.store.isWithdrawn(event.id)) events.push(event);
    const unique = [...new Map(events.map(event => [event.id, event])).values()];
    return { releaseId: release.id, generatedAt: release.corpus.generatedAt, events: unique.sort((a, b) => Date.parse(a.event!.start) - Date.parse(b.event!.start)), calendar: live.calendar, sourceGaps: live.calendar.status === 'available' ? sourceGaps.filter(source => !/https:\/\/(?:luma\.com|api\.lu\.ma)\//.test(source.url)) : sourceGaps };
  }
}
