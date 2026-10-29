export type Role = 'editor' | 'publisher' | 'admin';
export interface Actor { githubId: string; role: Role }
export interface Section { id: string; heading: string; text: string; kind?: 'explanation' | 'code' | 'exercise' | 'hint' | 'solution'; locator?: string }
export interface KnowledgeDocument {
  id: string; title: string; text: string; type: string; topics: string[]; year?: string; series?: string; order?: number; archived: boolean;
  origin?: 'imported' | 'curated'; importedContentHash?: string;
  source: { url: string; revision?: string; attribution?: string; license?: string; status: 'approved' | 'review-required' };
  sections?: Section[]; reviewedAt?: string; expiresAt?: string;
  event?: { start: string; end?: string; timezone?: string; registrationUrl?: string };
}
export interface SourceRecord { id: string; url: string; title: string; kind: string; status: 'imported' | 'link-only' | 'blocked' | 'missing' | 'review-required'; reason?: string; revision?: string; year?: string; license?: string; attribution?: string; documentIds: string[] }
export interface LearningPath { id: string; title: string; description: string; prerequisites: string[]; steps: { documentId: string; note?: string }[] }
export interface Corpus { schemaVersion: 1; documents: KnowledgeDocument[]; sources: SourceRecord[]; learningPaths: LearningPath[]; generatedAt: string; curatedDeletions?: string[] }
export interface Draft { id: string; revision: number; baseReleaseId: string | null; documents: KnowledgeDocument[]; deletedDocumentIds: string[]; sources?: SourceRecord[]; learningPaths?: LearningPath[]; updatedBy: string; updatedAt: string }
export interface Release { id: string; hash: string; createdAt: string; previousReleaseId: string | null; corpus: Corpus; index: unknown; operationId: string }
export interface ActivePointer { releaseId: string; hash: string; operationId: string; previousReleaseId: string | null }
export interface Candidate { id: string; hash: string; baseReleaseId: string | null; baseEtag: string | null; corpus: Corpus; createdAt: string; draftId: string; draftRevision: number; withdrawnDocumentIds?: string[] }
export interface SearchFilters { type?: string; topic?: string; year?: string; archived?: boolean }
export interface ValidationResult { valid: boolean; errors: string[]; warnings: string[] }
export class KnowledgeError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'KnowledgeError'; }
}
