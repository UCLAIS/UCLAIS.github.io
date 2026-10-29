import type { Corpus, KnowledgeDocument, SourceRecord } from '../types.js';

export interface ImportConflict { documentId: string; reason: string }
export interface ImportReconciliation {
  corpus: Corpus;
  conflicts: ImportConflict[];
  added: number;
  updated: number;
  unchanged: number;
  preserved: number;
}

// Import review state is deliberately excluded. A correction to title, body,
// code, teaching order, expiry, or licence changes the baseline fingerprint.
export function canonicalImportedContent(doc: KnowledgeDocument): string {
  return JSON.stringify({
    title: doc.title, text: doc.text, type: doc.type, topics: [...doc.topics].sort(),
    year: doc.year ?? null, archived: doc.archived,
    sections: (doc.sections ?? []).map(section => ({ id: section.id, heading: section.heading, text: section.text, kind: section.kind ?? null, locator: section.locator ?? null })),
    expiresAt: doc.expiresAt ?? null,
    event: doc.event ? { start: doc.event.start, end: doc.event.end ?? null, timezone: doc.event.timezone ?? null, registrationUrl: doc.event.registrationUrl ?? null } : null,
    license: doc.source.license ?? null, attribution: doc.source.attribution ?? null,
  });
}

export async function importedContentHash(doc: KnowledgeDocument): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalImportedContent(doc)));
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/** Re-imports are staged updates, never unconditional replacements of edits. */
export async function reconcileImport(active: Corpus, incoming: Corpus): Promise<ImportReconciliation> {
  const deletedIds = new Set(active.curatedDeletions ?? []);
  const documents = new Map(active.documents.filter(doc => !deletedIds.has(doc.id)).map(doc => [doc.id, structuredClone(doc)]));
  const incomingIds = new Set(incoming.documents.map(doc => doc.id));
  const preservedIds = new Set<string>();
  const conflicts: ImportConflict[] = [];
  let added = 0, updated = 0, unchanged = 0, preserved = 0;
  for (const candidate of incoming.documents) {
    if (deletedIds.has(candidate.id)) {
      preservedIds.add(candidate.id); preserved++;
      conflicts.push({ documentId: candidate.id, reason: 'This document was deliberately deleted by a curator. Re-import did not restore it; restoration requires an explicit curated upsert.' });
      continue;
    }
    const existing = documents.get(candidate.id);
    if (!existing) { documents.set(candidate.id, structuredClone(candidate)); added++; continue; }
    const existingHash = await importedContentHash(existing);
    const incomingHash = await importedContentHash(candidate);
    const protectedEdit = existing.origin !== 'imported' || !existing.importedContentHash || existingHash !== existing.importedContentHash;
    if (protectedEdit) {
      preservedIds.add(existing.id); preserved++;
      if (existingHash !== incomingHash) conflicts.push({ documentId: existing.id, reason: 'The existing document is curated or differs from its import baseline. Incoming source text was not applied.' });
      continue;
    }
    if (existingHash === incomingHash) {
      // Review approval may be retained only for this exact content/licence
      // baseline. Newer source citations can still move to the pinned revision.
      const next = structuredClone(candidate);
      next.source.status = existing.source.status;
      next.reviewedAt = existing.reviewedAt;
      documents.set(candidate.id, next); unchanged++;
    } else {
      // Never carry an old approval over changed text or changed licence facts.
      // The publisher reviews the resulting staged candidate before release.
      documents.set(candidate.id, structuredClone(candidate)); updated++;
    }
  }
  for (const doc of active.documents) {
    if (deletedIds.has(doc.id)) continue;
    if (!incomingIds.has(doc.id)) {
      preservedIds.add(doc.id); preserved++;
      if (doc.origin === 'imported') conflicts.push({ documentId: doc.id, reason: 'The source was absent from this import. The existing document was retained; deliberate removal requires a separate delete operation.' });
    }
  }
  const sourceMap = new Map<string, SourceRecord>(active.sources.map(source => [source.id, structuredClone(source)]));
  for (const source of incoming.sources) {
    const next = structuredClone(source);
    const skipped = next.documentIds.some(id => preservedIds.has(id));
    next.documentIds = next.documentIds.filter(id => !preservedIds.has(id));
    const previous = sourceMap.get(next.id);
    if (previous) {
      next.documentIds = [...new Set([...previous.documentIds.filter(id => preservedIds.has(id)), ...next.documentIds])];
    }
    if (skipped) next.reason = [next.reason, 'Locally curated document content was preserved; see import conflicts.'].filter(Boolean).join(' ');
    sourceMap.set(next.id, next);
  }
  const ids = new Set(documents.keys());
  const sources = [...sourceMap.values()].map(source => ({ ...source, documentIds: source.documentIds.filter(id => ids.has(id)) }));
  const paths = new Map(active.learningPaths.map(item => [item.id, structuredClone(item)]));
  for (const item of incoming.learningPaths) if (!paths.has(item.id)) paths.set(item.id, structuredClone(item));
  return {
    corpus: { schemaVersion: 1, generatedAt: incoming.generatedAt, documents: [...documents.values()].sort((a, b) => a.id.localeCompare(b.id)), sources, learningPaths: [...paths.values()].map(item => ({ ...item, steps: item.steps.filter(step => ids.has(step.documentId) && !deletedIds.has(step.documentId)) })).filter(item => item.steps.length > 0), ...(deletedIds.size ? { curatedDeletions: [...deletedIds].sort() } : {}) },
    conflicts, added, updated, unchanged, preserved,
  };
}
