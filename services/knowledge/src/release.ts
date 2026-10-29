import { approvedCorpus, makeIndex } from './core';
import type { ActivePointer, Actor, Candidate, Corpus, Draft, Release } from './types';
import { KnowledgeError } from './types';
import { sha256, type PublicationAttempt, type PublicationStore, type PublishedStore } from './storage';

export const candidateHash = (candidate: Omit<Candidate, 'hash' | 'id' | 'createdAt'>) => sha256(JSON.stringify({ baseReleaseId: candidate.baseReleaseId, baseEtag: candidate.baseEtag, corpus: candidate.corpus, draftId: candidate.draftId, draftRevision: candidate.draftRevision, withdrawnDocumentIds: candidate.withdrawnDocumentIds ?? [] }));
const mayPublish = (actor: Actor) => { if (actor.role !== 'publisher' && actor.role !== 'admin') throw new KnowledgeError('forbidden', 'Publisher permission required.', 403); };
const mergeById = <T extends { id: string }>(base: T[], updates: T[]) => [...new Map([...base, ...updates].map(x => [x.id, x])).values()];

export class ReleaseManager {
  constructor(private privateStore: PublicationStore, private published: PublishedStore) {}
  status() { return this.published.readActive(); }
  getCandidate(id: string) { return this.privateStore.getCandidate(id); }
  history() { return this.privateStore.listAttempts(); }
  private async saveCandidate(input: Omit<Candidate, 'id' | 'hash' | 'createdAt'>) {
    const candidate: Candidate = { ...input, id: crypto.randomUUID(), hash: await candidateHash(input), createdAt: new Date().toISOString() };
    await this.privateStore.putCandidate(candidate); return candidate;
  }
  async preview(draft: Draft): Promise<Omit<Candidate, 'id' | 'hash' | 'createdAt'>> {
    const active = await this.status();
    if (draft.baseReleaseId !== (active.pointer?.releaseId ?? null)) throw new KnowledgeError('stale_base', 'The public release changed. Rebase and review the draft again.', 409);
    const previous = active.pointer ? await this.published.readRelease(active.pointer.releaseId) : null;
    const base: Corpus = previous?.corpus ?? { schemaVersion: 1, generatedAt: draft.updatedAt, documents: [], sources: [], learningPaths: [] };
    const deletions = new Set([...(base.curatedDeletions ?? []), ...draft.deletedDocumentIds]);
    for (const doc of draft.documents) if (doc.origin === 'curated' && !draft.deletedDocumentIds.includes(doc.id)) deletions.delete(doc.id);
    // An unreviewed replacement must not silently delete the last approved body.
    const approvedUpdates = draft.documents.filter(doc => doc.source.status === 'approved');
    const documents = mergeById(base.documents, approvedUpdates).filter(x => !deletions.has(x.id));
    const available = new Set(documents.map(doc => doc.id));
    const corpus = approvedCorpus({ ...base, curatedDeletions: [...deletions], generatedAt: new Date().toISOString(), documents, sources: mergeById(base.sources, draft.sources ?? []), learningPaths: mergeById(base.learningPaths, draft.learningPaths ?? []).map(path => ({ ...path, steps: path.steps.filter(step => available.has(step.documentId)) })).filter(path => path.steps.length > 0) });
    for (const document of corpus.documents) if (await this.published.isWithdrawn(document.id)) throw new KnowledgeError('withdrawn_document', `Withdrawn document cannot be republished: ${document.id}`, 409);
    return { baseReleaseId: active.pointer?.releaseId ?? null, baseEtag: active.etag, corpus, draftId: draft.id, draftRevision: draft.revision };
  }
  async prepare(draft: Draft, actor: Actor): Promise<Candidate> {
    const candidate = await this.preview(draft);
    await this.privateStore.audit({ action: 'candidate.prepared', actorId: actor.githubId, targetId: draft.id, at: new Date().toISOString() });
    return this.saveCandidate(candidate);
  }
  private async committed(attempt: PublicationAttempt): Promise<boolean> {
    const { pointer } = await this.status(); let id = pointer?.releaseId; const seen = new Set<string>();
    while (id && !seen.has(id) && seen.size < 10000) { if (id === attempt.releaseId) return true; seen.add(id); const release = await this.published.readAncestry(id); id = release?.previousReleaseId ?? undefined; }
    return false;
  }
  private async finishWithdrawal(candidate: Candidate) {
    if (!candidate.withdrawnDocumentIds?.length) return;
    // Markers protect in-flight readers and version-pinned fetches before old snapshots are removed.
    for (const id of candidate.withdrawnDocumentIds) await this.published.markWithdrawn(id);
    for (const releaseId of await this.published.listReleaseIds()) {
      const release = await this.published.readRelease(releaseId);
      if (release?.corpus.documents.some(doc => candidate.withdrawnDocumentIds!.includes(doc.id))) {
        if ((await this.status()).pointer?.releaseId === releaseId) throw new KnowledgeError('withdrawal_recovery_required', 'Withdrawal remains protected but requires recovery before this snapshot can be removed.', 503);
        await this.published.deleteRelease(releaseId);
      }
    }
  }
  /** Finish already-activated releases without depending on an expiring browser approval. */
  async reconcile(): Promise<{ reconciled: number }> {
    const attempts = this.privateStore.listPendingAttempts ? await this.privateStore.listPendingAttempts() : await this.privateStore.listAttempts();
    let reconciled = 0;
    for (const attempt of attempts) {
      if (attempt.state === 'conflict' || attempt.cleanupComplete) continue;
      if (attempt.state !== 'committed' && !await this.committed(attempt)) continue;
      const candidate = await this.getCandidate(attempt.candidateId);
      if (!candidate || await candidateHash(candidate) !== attempt.candidateHash) throw new KnowledgeError('invalid_recovery', 'Publication recovery requires administrator attention.', 503);
      await this.finishWithdrawal(candidate);
      await this.privateStore.putAttempt({ ...attempt, state: 'committed', completedAt: attempt.completedAt ?? new Date().toISOString(), cleanupComplete: true });
      await this.privateStore.audit({ action: 'release.recovered', actorId: attempt.actorId, targetId: attempt.releaseId, at: new Date().toISOString() });
      reconciled++;
    }
    return { reconciled };
  }
  async publish(candidateId: string, expectedHash: string, actor: Actor, operationId: string): Promise<ActivePointer> {
    mayPublish(actor);
    if (!/^[a-f0-9-]{16,80}$/.test(operationId)) throw new KnowledgeError('invalid_operation', 'Invalid publication operation.');
    const candidate = await this.getCandidate(candidateId);
    if (!candidate) throw new KnowledgeError('not_found', 'Candidate not found.', 404);
    if (expectedHash !== candidate.hash || await candidateHash(candidate) !== candidate.hash) throw new KnowledgeError('candidate_changed', 'Candidate content changed. Review again.', 409);
    let attempt = await this.privateStore.getAttempt(operationId);
    if (attempt && (attempt.actorId !== actor.githubId || attempt.candidateHash !== candidate.hash || attempt.candidateId !== candidateId)) throw new KnowledgeError('operation_mismatch', 'Publication operation belongs to another request.', 409);
    if (attempt && (attempt.state === 'committed' || await this.committed(attempt))) {
      await this.finishWithdrawal(candidate);
      attempt.state = 'committed'; attempt.cleanupComplete = true; attempt.completedAt ??= new Date().toISOString(); await this.privateStore.putAttempt(attempt);
      return { releaseId: attempt.releaseId, hash: candidate.hash, operationId, previousReleaseId: attempt.previousReleaseId };
    }
    const active = await this.status();
    if (active.etag !== candidate.baseEtag || (active.pointer?.releaseId ?? null) !== candidate.baseReleaseId) throw new KnowledgeError('stale_base', 'The public release changed. Prepare and review again.', 409);
    const corpus = approvedCorpus(candidate.corpus);
    for (const doc of corpus.documents) if (await this.published.isWithdrawn(doc.id)) throw new KnowledgeError('withdrawn_document', 'A candidate includes withdrawn material. Prepare it again.', 409);
    const releaseId = await sha256(`${operationId}:${candidate.hash}`);
    attempt ??= { id: operationId, candidateId, candidateHash: candidate.hash, actorId: actor.githubId, releaseId, previousReleaseId: candidate.baseReleaseId, state: 'pending', createdAt: new Date().toISOString() };
    await this.privateStore.putAttempt(attempt);
    // Withdrawal is deliberately fail-closed: approved deny markers must exist
    // before exposing a base on which another publisher could reintroduce a record.
    for (const id of candidate.withdrawnDocumentIds ?? []) await this.published.markWithdrawn(id);
    const release: Release = { id: releaseId, hash: candidate.hash, createdAt: attempt.createdAt, previousReleaseId: candidate.baseReleaseId, corpus, index: makeIndex(corpus).toJSON(), operationId };
    await this.published.putRelease(release);
    const pointer: ActivePointer = { releaseId, hash: candidate.hash, operationId, previousReleaseId: candidate.baseReleaseId };
    if (!await this.published.compareAndSwapActive(pointer, candidate.baseEtag)) {
      if (!await this.committed(attempt)) { attempt.state = 'conflict'; await this.privateStore.putAttempt(attempt); throw new KnowledgeError('stale_base', 'Another release was published first. Review again.', 409); }
    }
    await this.finishWithdrawal(candidate);
    attempt.state = 'committed'; attempt.cleanupComplete = true; attempt.completedAt = new Date().toISOString(); await this.privateStore.putAttempt(attempt);
    await this.privateStore.audit({ action: candidate.withdrawnDocumentIds?.length ? 'release.withdrawn' : 'release.published', actorId: actor.githubId, targetId: releaseId, at: attempt.completedAt });
    return pointer;
  }
  async rollback(targetReleaseId: string, actor: Actor) {
    mayPublish(actor); const target = await this.published.readRelease(targetReleaseId); if (!target) throw new KnowledgeError('not_found', 'Release is unavailable or withdrawn.', 404);
    for (const doc of target.corpus.documents) if (await this.published.isWithdrawn(doc.id)) throw new KnowledgeError('withdrawn_document', 'Rollback cannot restore withdrawn material.', 409);
    const active = await this.status(); return this.saveCandidate({ baseReleaseId: active.pointer?.releaseId ?? null, baseEtag: active.etag, corpus: { ...target.corpus, generatedAt: new Date().toISOString() }, draftId: `rollback:${targetReleaseId}`, draftRevision: 1 });
  }
  async withdraw(documentIds: string[], actor: Actor) {
    mayPublish(actor); if (!documentIds.length || documentIds.length > 100) throw new KnowledgeError('invalid_withdrawal', 'Select 1–100 resources.');
    const active = await this.status(); if (!active.pointer) throw new KnowledgeError('not_published', 'No release exists.', 409);
    const release = await this.published.readRelease(active.pointer.releaseId); if (!release) throw new KnowledgeError('not_found', 'Active release is unavailable.', 503);
    const ids = [...new Set(documentIds)];
    const known = new Set(release.corpus.documents.map(doc => doc.id));
    // A publisher may also withdraw an event from the already-approved live calendar.
    if (release.corpus.sources.some(source => source.url === 'https://luma.com/UCLAISociety')) for (const id of ids) if (/^luma:(?:evt|calev)-[A-Za-z0-9]{1,100}$/.test(id)) known.add(id);
    for (const id of ids) if (!known.has(id) && await this.published.isWithdrawn(id)) known.add(id);
    if (ids.some(id => !known.has(id))) for (const historicalId of await this.published.listReleaseIds()) {
      const historical = await this.published.readRelease(historicalId);
      for (const doc of historical?.corpus.documents ?? []) known.add(doc.id);
    }
    if (ids.some(id => !known.has(id))) throw new KnowledgeError('not_found', 'One or more resources were not found in current or historical releases.', 404);
    const corpus = { ...release.corpus, curatedDeletions: [...new Set([...(release.corpus.curatedDeletions ?? []), ...ids])], generatedAt: new Date().toISOString(), documents: release.corpus.documents.filter(x => !ids.includes(x.id)), learningPaths: release.corpus.learningPaths.map(x => ({ ...x, steps: x.steps.filter(step => !ids.includes(step.documentId)) })).filter(x => x.steps.length > 0) };
    return this.saveCandidate({ baseReleaseId: release.id, baseEtag: active.etag, corpus, draftId: `withdrawal:${crypto.randomUUID()}`, draftRevision: 1, withdrawnDocumentIds: ids });
  }
}
