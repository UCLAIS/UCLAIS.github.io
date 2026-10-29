import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { approvedCorpus, KnowledgeReader, makeIndex, validateCorpus } from '../src/core';
import { MemoryPublishedStore, sha256 } from '../src/storage';
import type { Corpus, Release } from '../src/types';

describe('actual portal and teaching corpus acceptance', () => {
  const corpus = JSON.parse(readFileSync(new URL('../data/bootstrap-corpus.json', import.meta.url), 'utf8')) as Corpus;
  let reader: KnowledgeReader;
  beforeAll(async () => {
    const store = new MemoryPublishedStore(); const approved = approvedCorpus(corpus);
    const release: Release = { id: crypto.randomUUID(), hash: await sha256(JSON.stringify(approved)), createdAt: corpus.generatedAt, previousReleaseId: null, corpus: approved, index: makeIndex(approved).toJSON(), operationId: crypto.randomUUID() };
    await store.putRelease(release); await store.compareAndSwapActive({ releaseId: release.id, hash: release.hash, operationId: release.operationId, previousReleaseId: null }, null);
    reader = new KnowledgeReader(store);
  });
  it('validates the published bootstrap with only approved bodies and visible source gaps', () => {
    expect(validateCorpus(corpus)).toMatchObject({ valid: true, errors: [] });
    expect(corpus.documents.length).toBeGreaterThan(170);
    expect(corpus.documents.every(doc => doc.source.status === 'approved')).toBe(true);
    expect(corpus.sources.some(source => source.status === 'review-required')).toBe(true);
    expect(corpus.sources.some(source => source.status === 'blocked')).toBe(true);
  });
  it('answers membership from its evidenced FAQ without inventing prices', async () => {
    const found = await reader.search('society membership');
    expect(found.results[0].documentId).toBe('faq:society-membership');
    const resource = await reader.fetch(found.results[0].documentId, undefined, found.releaseId);
    expect(resource.text).toContain('studentsunionucl.org'); expect(resource.text).toContain('does not establish membership prices');
  });
  it('provides the society principles and explicit committee escalation with an AI accuracy disclaimer', async () => {
    const values = await reader.fetch('faq:society-values');
    expect(values.text).toContain('Never Build for Lethality');
    expect(values.text).toContain('Defend Human Creativity');
    expect(values.text).toContain('https://uclai.co.uk/about-us/#ethics-title');
    const help = await reader.fetch('faq:knowledge-help');
    expect(help.text).toContain('may be incorrect');
    expect(help.text).toContain('info@uclai.co.uk');
  });
  it('preserves current Nexus closure and explicitly historical tutorial schedules', async () => {
    expect((await reader.fetch('faq:nexus-applications')).text).toContain('applications are now closed');
    expect((await reader.fetch('faq:tutorial-archive')).text).toContain('not a current timetable');
    const results = await reader.search('Python', { archived: true });
    expect(results.results.length).toBeGreaterThan(0); expect(results.results.every(item => item.archived)).toBe(true);
  });
  it('retrieves actual notebook code cells with pinned source commits and provenance', async () => {
    const notebook = corpus.documents.find(doc => doc.id.startsWith('teaching:') && doc.sections?.some(section => section.kind === 'code'))!;
    const cell = notebook.sections!.find(section => section.kind === 'code')!;
    const fetched = await reader.fetch(notebook.id, cell.id);
    expect(fetched.text).toBe(cell.text); expect(fetched.sections![0].locator).toContain('notebook cell');
    expect(fetched.source.revision).toMatch(/^[a-f0-9]{40}$/); expect(fetched.freshness).toBe('archived');
  });
  it('reports the unavailable live calendar feed rather than inventing events', async () => {
    const events = await reader.listEvents(); expect(events.events).toEqual([]);
    expect(events.sourceGaps.some(source => source.url.includes('luma.com/UCLAISociety'))).toBe(true);
  });
  it('returns rights and unavailable-source metadata alongside relevant public searches', async () => {
    const result = await reader.search('membership');
    expect(result.sourceGaps.some(source => source.status === 'missing' && source.title.includes('cost'))).toBe(true);
    const pending = corpus.sources.find(source => source.status === 'review-required' && source.title.includes('Slides'))!;
    expect(pending).toBeTruthy();
    const slides = await reader.search('Slides');
    expect(slides.sourceGaps.some(source => source.status === 'review-required' || source.status === 'link-only')).toBe(true);
  });
});
