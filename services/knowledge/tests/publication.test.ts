import { describe, expect, it } from 'vitest';
import { KnowledgeReader, validateCorpus } from '../src/core';
import { ReleaseManager } from '../src/release';
import { MemoryPublicationStore, MemoryPublishedStore } from '../src/storage';
import type { Actor, Corpus, Draft, KnowledgeDocument } from '../src/types';

const actor: Actor = { githubId: '57414242', role: 'admin' };
const doc = (id = 'tutorial:python'): KnowledgeDocument => ({ id, title: 'Archived Python tutorial', text: 'Python lists and functions. Applications are closed.', type: 'tutorial', topics: ['python'], archived: true, year: '2024/25', source: { url: 'https://uclai.co.uk/tutorials/python', status: 'approved' }, sections: [{ id: 'cell-1', heading: 'Python list exercise', text: 'values = [1, 2, 3]\nprint(sum(values))', kind: 'code', locator: 'cell:1' }] });
const corpus = (documents = [doc()]): Corpus => ({ schemaVersion: 1, generatedAt: '2026-10-29T12:00:00Z', documents, sources: [], learningPaths: [] });
const draft = (documents = [doc()], baseReleaseId: string | null = null): Draft => ({ id: crypto.randomUUID(), revision: 1, baseReleaseId, documents, deletedDocumentIds: [], updatedBy: actor.githubId, updatedAt: '2026-10-29T12:00:00Z' });
function setup() { const privateStore = new MemoryPublicationStore(); const published = new MemoryPublishedStore(); const manager = new ReleaseManager(privateStore, published); return { privateStore, published, manager }; }
async function seed() { const state = setup(); const candidate = await state.manager.prepare(draft(), actor); const pointer = await state.manager.publish(candidate.id, candidate.hash, actor, crypto.randomUUID()); return { ...state, pointer, candidate }; }

describe('publication authority and immutable review', () => {
  it('does not publish preparation and excludes unreviewed bodies', async () => {
    const { manager, published } = setup(); const pending = { ...doc('pending'), text: 'unreviewed body', source: { ...doc().source, status: 'review-required' as const } };
    const candidate = await manager.prepare(draft([doc(), pending]), actor);
    expect(await published.readActive()).toEqual({ pointer: null, etag: null });
    expect(candidate.corpus.documents.map(x => x.id)).toEqual(['tutorial:python']);
  });
  it('rejects editor publication even with a valid candidate', async () => {
    const { manager } = setup(); const candidate = await manager.prepare(draft(), actor);
    await expect(manager.publish(candidate.id, candidate.hash, { githubId: '7', role: 'editor' }, crypto.randomUUID())).rejects.toMatchObject({ status: 403 });
  });
  it('keeps the approved body when an upstream replacement is still awaiting review', async () => {
    const state = await seed();
    const pending = { ...doc(), text: 'new unreviewed text', source: { ...doc().source, status: 'review-required' as const } };
    const candidate = await state.manager.prepare(draft([pending], state.pointer.releaseId), actor);
    expect(candidate.corpus.documents[0].text).toBe(doc().text);
  });
  it('rejects changed candidate content and wrong approved hashes', async () => {
    const { manager, privateStore } = setup(); const candidate = await manager.prepare(draft(), actor);
    await expect(manager.publish(candidate.id, 'different', actor, crypto.randomUUID())).rejects.toMatchObject({ code: 'candidate_changed' });
    privateStore.candidates.get(candidate.id)!.corpus.documents[0].text = 'tampered';
    await expect(manager.publish(candidate.id, candidate.hash, actor, crypto.randomUUID())).rejects.toMatchObject({ code: 'candidate_changed' });
  });
  it('prevents stale or concurrent activation and leaves one complete release', async () => {
    const { manager, published } = setup(); const a = await manager.prepare(draft(), actor); const b = await manager.prepare(draft([doc('other')]), actor);
    const results = await Promise.allSettled([manager.publish(a.id, a.hash, actor, crypto.randomUUID()), manager.publish(b.id, b.hash, actor, crypto.randomUUID())]);
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(x => x.status === 'rejected')).toHaveLength(1);
    const { pointer } = await published.readActive(); expect((await published.readRelease(pointer!.releaseId))!.corpus.documents).toHaveLength(1);
  });
  it('retries the same publication once and prevents operation-key substitution', async () => {
    const { manager } = setup(); const candidate = await manager.prepare(draft(), actor); const operation = crypto.randomUUID();
    const first = await manager.publish(candidate.id, candidate.hash, actor, operation);
    expect(await manager.publish(candidate.id, candidate.hash, actor, operation)).toEqual(first);
    await expect(manager.publish(candidate.id, candidate.hash, { ...actor, githubId: '8' }, operation)).rejects.toMatchObject({ code: 'operation_mismatch' });
  });
  it('recovers a crash after pointer activation before recording success', async () => {
    const { manager, privateStore, published } = setup(); const candidate = await manager.prepare(draft(), actor); const operation = crypto.randomUUID();
    const original = privateStore.putAttempt.bind(privateStore); let crash = true;
    privateStore.putAttempt = async attempt => { if (attempt.state === 'committed' && crash) { crash = false; throw new Error('simulated crash'); } await original(attempt); };
    await expect(manager.publish(candidate.id, candidate.hash, actor, operation)).rejects.toThrow('simulated crash');
    const pointer = (await published.readActive()).pointer;
    expect(await manager.publish(candidate.id, candidate.hash, actor, operation)).toEqual(pointer);
    expect((await manager.history())[0].state).toBe('committed'); expect(published.version).toBe(1);
  });
  it('failed upload never changes active release', async () => {
    const state = await seed(); const candidate = await state.manager.prepare(draft([doc('second')], state.pointer.releaseId), actor);
    state.published.putRelease = async () => { throw new Error('storage failed'); };
    await expect(state.manager.publish(candidate.id, candidate.hash, actor, crypto.randomUUID())).rejects.toThrow('storage failed');
    expect((await state.manager.status()).pointer).toEqual(state.pointer);
  });
});

describe('version-pinned retrieval, rollback and withdrawal', () => {
  it('retrieves actual code cells, provenance and archive year', async () => {
    const { published, pointer } = await seed(); const reader = new KnowledgeReader(published); const found = await reader.search('Python');
    expect(found.results[0]).toMatchObject({ documentId: 'tutorial:python', sectionId: 'cell-1', archived: true, year: '2024/25', releaseId: pointer.releaseId });
    expect(await reader.fetch('tutorial:python', 'cell-1', pointer.releaseId)).toMatchObject({ text: 'values = [1, 2, 3]\nprint(sum(values))', releaseId: pointer.releaseId });
  });
  it('keeps fetch on the search release after another publication', async () => {
    const state = await seed(); const reader = new KnowledgeReader(state.published); const search = await reader.search('Python');
    const changed = { ...doc(), text: 'new content', sections: [{ id: 'cell-1', heading: 'Changed', text: 'new cell' }] };
    const next = await state.manager.prepare(draft([changed], state.pointer.releaseId), actor); await state.manager.publish(next.id, next.hash, actor, crypto.randomUUID());
    expect((await reader.fetch(doc().id, 'cell-1', search.releaseId)).text).toContain('values');
    expect((await reader.fetch(doc().id, 'cell-1')).text).toBe('new cell');
  });
  it('withdrawal purges old snapshots and blocks cached/version-pinned reads and rollback', async () => {
    const state = await seed(); const reader = new KnowledgeReader(state.published); await reader.fetch(doc().id);
    const withdrawal = await state.manager.withdraw([doc().id], actor);
    expect(state.published.withdrawn.size).toBe(0);
    await state.manager.publish(withdrawal.id, withdrawal.hash, actor, crypto.randomUUID());
    await expect(reader.fetch(doc().id, undefined, state.pointer.releaseId)).rejects.toMatchObject({ status: 404 });
    await expect(reader.fetch(doc().id)).rejects.toMatchObject({ status: 404 });
    await expect(state.manager.rollback(state.pointer.releaseId, actor)).rejects.toMatchObject({ status: 404 });
    expect((await reader.search('Python')).results).toHaveLength(0);
  });
  it('filters expired events and never treats archived sessions as upcoming', async () => {
    const state = setup(); const events = [
      { ...doc('expired'), archived: false, expiresAt: '2026-10-28T12:00:00Z', event: { start: '2026-11-01T12:00:00Z' } },
      { ...doc('archive'), event: { start: '2026-11-01T12:00:00Z' } },
      { ...doc('upcoming'), archived: false, event: { start: '2026-11-01T12:00:00Z' } },
    ]; const candidate = await state.manager.prepare(draft(events), actor); await state.manager.publish(candidate.id, candidate.hash, actor, crypto.randomUUID());
    expect((await new KnowledgeReader(state.published).listEvents(new Date('2026-10-29T12:00:00Z'))).events.map(x => x.id)).toEqual(['upcoming']);
  });
  it('rejects malformed corpus, duplicate identifiers and missing path targets', () => {
    expect(validateCorpus(corpus([doc(), doc()])).valid).toBe(false);
    expect(validateCorpus({ ...corpus(), learningPaths: [{ id: 'missing', title: 'Missing', description: '', prerequisites: [], steps: [{ documentId: 'absent' }] }] }).valid).toBe(false);
  });
  it('keeps curated deletions across re-imports and permits deliberate curated restoration', async () => {
    const state = await seed();
    const deletion = draft([], state.pointer.releaseId); deletion.deletedDocumentIds = [doc().id];
    const removed = await state.manager.prepare(deletion, actor); const removedPointer = await state.manager.publish(removed.id, removed.hash, actor, crypto.randomUUID());
    const imported = await state.manager.prepare(draft([{ ...doc(), origin: 'imported' }], removedPointer.releaseId), actor);
    expect(imported.corpus.documents).toHaveLength(0); expect(imported.corpus.curatedDeletions).toContain(doc().id);
    const restored = await state.manager.prepare(draft([{ ...doc(), origin: 'curated' }], removedPointer.releaseId), actor);
    expect(restored.corpus.documents).toHaveLength(1); expect(restored.corpus.curatedDeletions).not.toContain(doc().id);
  });
});
