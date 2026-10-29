import { afterEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeReader } from '../src/core';
import { ReleaseManager } from '../src/release';
import { MemoryPublicationStore, MemoryPublishedStore } from '../src/storage';
import type { Actor, Draft, KnowledgeDocument } from '../src/types';

const actor: Actor = { githubId: '57414242', role: 'admin' };
const document = (id: string): KnowledgeDocument => ({ id, title: id, text: `${id} public text`, type: 'society', topics: [], archived: false, source: { url: 'https://uclai.co.uk/', status: 'approved' } });
const draft = (documents: KnowledgeDocument[], baseReleaseId: string | null = null, deletedDocumentIds: string[] = []): Draft => ({ id: crypto.randomUUID(), revision: 1, baseReleaseId, documents, deletedDocumentIds, updatedBy: actor.githubId, updatedAt: new Date().toISOString() });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
async function setup() {
  const store = new MemoryPublishedStore(); const privateStore = new MemoryPublicationStore(); const manager = new ReleaseManager(privateStore, store);
  const initial = await manager.prepare(draft([document('withdraw-me'), document('keep-me')]), actor);
  const pointer = await manager.publish(initial.id, initial.hash, actor, crypto.randomUUID());
  return { store, privateStore, manager, pointer };
}
afterEach(() => vi.useRealTimers());

describe('withdrawal concurrency and recovery', () => {
  it('never deletes the active snapshot when another publisher races before the deny marker is written', async () => {
    const { store, manager, pointer: original } = await setup();
    const withdrawal = await manager.withdraw(['withdraw-me'], actor);
    const entered = deferred(); const resume = deferred(); let pause = true;
    const originalMark = store.markWithdrawn.bind(store);
    store.markWithdrawn = async id => { if (pause) { pause = false; entered.resolve(); await resume.promise; } await originalMark(id); };
    const withdrawing = manager.publish(withdrawal.id, withdrawal.hash, actor, crypto.randomUUID()).then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
    await entered.promise;
    const concurrentBase = (await store.readActive()).pointer!.releaseId;
    let competingError: unknown;
    try {
      const candidate = await manager.prepare(draft([document('withdraw-me')], concurrentBase), actor);
      await manager.publish(candidate.id, candidate.hash, actor, crypto.randomUUID());
    } catch (error) { competingError = error; }
    resume.resolve(); await withdrawing;
    // If the withdrawal already exposed its new base, a reintroduction must be rejected.
    if (concurrentBase !== original.releaseId) expect(competingError).toBeDefined();
    const active = (await store.readActive()).pointer!;
    expect(await store.readRelease(active.releaseId)).not.toBeNull();
    const reader = new KnowledgeReader(store);
    expect((await reader.fetch('keep-me')).id).toBe('keep-me');
    await expect(reader.fetch('withdraw-me')).rejects.toMatchObject({ status: 404 });
  });

  it('rejects reintroduction once a deny marker exists, before exposing a new base', async () => {
    const { store, manager } = await setup();
    const withdrawal = await manager.withdraw(['withdraw-me'], actor);
    const entered = deferred(); const resume = deferred(); let pause = true;
    const originalMark = store.markWithdrawn.bind(store);
    store.markWithdrawn = async id => { await originalMark(id); if (pause) { pause = false; entered.resolve(); await resume.promise; } };
    const withdrawing = manager.publish(withdrawal.id, withdrawal.hash, actor, crypto.randomUUID());
    await entered.promise;
    const current = (await store.readActive()).pointer!;
    try { await expect(manager.prepare(draft([document('withdraw-me')], current.releaseId), actor)).rejects.toMatchObject({ code: 'withdrawn_document' }); }
    finally { resume.resolve(); }
    await withdrawing;
    expect((await new KnowledgeReader(store).fetch('keep-me')).id).toBe('keep-me');
  });

  it('finishes cleanup after activation even when the original browser approval would have expired', async () => {
    const { store, privateStore, manager, pointer } = await setup();
    const withdrawal = await manager.withdraw(['withdraw-me'], actor); const operation = crypto.randomUUID();
    const originalList = store.listReleaseIds.bind(store); let fail = true;
    store.listReleaseIds = async () => { if (fail) { fail = false; throw new Error('crash after activation'); } return originalList(); };
    await expect(manager.publish(withdrawal.id, withdrawal.hash, actor, operation)).rejects.toThrow('crash after activation');
    expect((await privateStore.getAttempt(operation))!.state).toBe('pending');
    expect(await store.readRelease(pointer.releaseId)).not.toBeNull();
    vi.useFakeTimers(); vi.setSystemTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
    expect((await manager.reconcile()).reconciled).toBeGreaterThan(0);
    expect(await store.readRelease(pointer.releaseId)).toBeNull();
    expect(await privateStore.getAttempt(operation)).toMatchObject({ state: 'committed', cleanupComplete: true });
    const reader = new KnowledgeReader(store);
    await expect(reader.fetch('withdraw-me', undefined, pointer.releaseId)).rejects.toMatchObject({ status: 404 });
    expect((await reader.fetch('keep-me')).id).toBe('keep-me');
  });

  it('can withdraw historical-only content after an ordinary draft deleted it', async () => {
    const { store, manager, pointer } = await setup();
    const deletion = await manager.prepare(draft([], pointer.releaseId, ['withdraw-me']), actor);
    await manager.publish(deletion.id, deletion.hash, actor, crypto.randomUUID());
    expect((await new KnowledgeReader(store).fetch('withdraw-me', undefined, pointer.releaseId)).id).toBe('withdraw-me');
    const withdrawal = await manager.withdraw(['withdraw-me'], actor);
    await manager.publish(withdrawal.id, withdrawal.hash, actor, crypto.randomUUID());
    expect(await store.readRelease(pointer.releaseId)).toBeNull();
    await expect(new KnowledgeReader(store).fetch('withdraw-me', undefined, pointer.releaseId)).rejects.toMatchObject({ status: 404 });
  });

  it('can recognise an activated pending operation after withdrawal removes intermediate snapshot bodies', async () => {
    const { store, privateStore, manager, pointer } = await setup();
    const candidate = await manager.prepare(draft([document('extra')], pointer.releaseId), actor); const operation = crypto.randomUUID();
    const originalPut = privateStore.putAttempt.bind(privateStore); let fail = true;
    privateStore.putAttempt = async attempt => { if (attempt.id === operation && attempt.state === 'committed' && fail) { fail = false; throw new Error('lost success record'); } await originalPut(attempt); };
    await expect(manager.publish(candidate.id, candidate.hash, actor, operation)).rejects.toThrow('lost success record');
    const middleBase = (await store.readActive()).pointer!;
    const middle = await manager.prepare(draft([document('another')], middleBase.releaseId), actor);
    await manager.publish(middle.id, middle.hash, actor, crypto.randomUUID());
    const withdrawal = await manager.withdraw(['withdraw-me'], actor);
    await manager.publish(withdrawal.id, withdrawal.hash, actor, crypto.randomUUID());
    await manager.reconcile();
    expect(await privateStore.getAttempt(operation)).toMatchObject({ state: 'committed', cleanupComplete: true });
  });
});
