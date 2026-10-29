import { AwsClient } from 'aws4fetch';
import type { ActivePointer, Candidate, Release } from './types';
import { KnowledgeError } from './types';

export interface PublicationAttempt {
  id: string; candidateId: string; candidateHash: string; actorId: string;
  releaseId: string; previousReleaseId: string | null;
  state: 'pending' | 'committed' | 'conflict'; createdAt: string; completedAt?: string;
  cleanupComplete?: boolean;
}
export interface AuditEvent { action: string; actorId: string; targetId: string; at: string; detail?: string }
export interface PublicationStore {
  getCandidate(id: string): Promise<Candidate | null>;
  putCandidate(candidate: Candidate): Promise<void>;
  getAttempt(id: string): Promise<PublicationAttempt | null>;
  putAttempt(attempt: PublicationAttempt): Promise<void>;
  listAttempts(): Promise<PublicationAttempt[]>;
  listPendingAttempts?(): Promise<PublicationAttempt[]>;
  audit(event: AuditEvent): Promise<void>;
}
export interface PublishedReader {
  readActive(): Promise<{ pointer: ActivePointer | null; etag: string | null }>;
  readRelease(id: string): Promise<Release | null>;
  hasRelease?(id: string): Promise<boolean>;
  isWithdrawn(documentId: string): Promise<boolean>;
}
export interface PublishedStore extends PublishedReader {
  putRelease(release: Release): Promise<void>;
  compareAndSwapActive(pointer: ActivePointer, expectedEtag: string | null): Promise<boolean>;
  listReleaseIds(): Promise<string[]>;
  deleteRelease(id: string): Promise<void>;
  markWithdrawn(documentId: string): Promise<void>;
  readAncestry(id: string): Promise<{ releaseId: string; previousReleaseId: string | null; operationId: string } | null>;
}
export function releaseKey(id: string) {
  if (!/^[a-f0-9-]{16,80}$/.test(id)) throw new KnowledgeError('invalid_release', 'Invalid release identifier.');
  return `releases/${id}.json`;
}
const cleanEtag = (value: string | null) => value?.replace(/^"|"$/g, '') ?? null;
const withdrawalKey = async (id: string) => `withdrawals/${await sha256(id)}.json`;
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Uses an actual bucket-scoped S3 Object Read-only credential. No write methods exist. */
export class S3PublishedReader implements PublishedReader {
  private client: AwsClient;
  private base: URL;
  constructor(endpoint: string, bucket: string, accessKeyId: string, secretAccessKey: string) {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/.test(url.hostname) || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(bucket)) {
      throw new KnowledgeError('configuration', 'Published storage is not configured correctly.', 503);
    }
    this.base = new URL(`/${bucket}/`, url);
    this.client = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  }
  private async get(key: string): Promise<Response> {
    const response = await this.client.fetch(new URL(key, this.base).toString(), { method: 'GET', redirect: 'manual', headers: { 'Cache-Control': 'no-cache' } });
    if (response.status !== 404 && !response.ok) throw new KnowledgeError('storage_unavailable', 'Published knowledge is temporarily unavailable.', 503);
    return response;
  }
  async readActive() {
    const response = await this.get('active.json');
    return response.status === 404 ? { pointer: null, etag: null } : { pointer: await response.json() as ActivePointer, etag: cleanEtag(response.headers.get('etag')) };
  }
  async readRelease(id: string) {
    const response = await this.get(releaseKey(id));
    return response.status === 404 ? null : await response.json() as Release;
  }
  async hasRelease(id: string) { const request = await this.client.fetch(new URL(releaseKey(id), this.base).toString(), { method: 'HEAD', redirect: 'manual' }); if (!request.ok && request.status !== 404) throw new KnowledgeError('storage_unavailable', 'Published knowledge is temporarily unavailable.', 503); return request.ok; }
  async isWithdrawn(id: string) { return (await this.get(await withdrawalKey(id))).status !== 404; }
}

/** Only the privileged admin deployment receives this native writable binding. */
export class NativePublishedStore implements PublishedStore {
  constructor(private bucket: R2Bucket) {}
  async readActive() {
    const object = await this.bucket.get('active.json');
    return object ? { pointer: await object.json<ActivePointer>(), etag: object.etag } : { pointer: null, etag: null };
  }
  async readRelease(id: string) { const object = await this.bucket.get(releaseKey(id)); return object ? object.json<Release>() : null; }
  async hasRelease(id: string) { return await this.bucket.head(releaseKey(id)) !== null; }
  async putRelease(release: Release) {
    await this.bucket.put(releaseKey(release.id), JSON.stringify(release), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
    await this.bucket.put(`ancestry/${releaseKey(release.id).slice(9)}`, JSON.stringify({ releaseId: release.id, previousReleaseId: release.previousReleaseId, operationId: release.operationId }), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
  }
  async readAncestry(id: string) { const object = await this.bucket.get(`ancestry/${releaseKey(id).slice(9)}`); if (object) return object.json<{ releaseId: string; previousReleaseId: string | null; operationId: string }>(); const release = await this.readRelease(id); return release ? { releaseId: release.id, previousReleaseId: release.previousReleaseId, operationId: release.operationId } : null; }
  async compareAndSwapActive(pointer: ActivePointer, expectedEtag: string | null) {
    const result = await this.bucket.put('active.json', JSON.stringify(pointer), {
      onlyIf: expectedEtag ? { etagMatches: expectedEtag } : { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
    });
    return result !== null;
  }
  async listReleaseIds() {
    const ids: string[] = []; let cursor: string | undefined;
    do { const page = await this.bucket.list({ prefix: 'releases/', cursor }); ids.push(...page.objects.map(x => x.key.slice(9, -5))); cursor = page.truncated ? page.cursor : undefined; } while (cursor);
    return ids;
  }
  async deleteRelease(id: string) { await this.bucket.delete(releaseKey(id)); }
  async markWithdrawn(id: string) { await this.bucket.put(await withdrawalKey(id), '{}', { httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' } }); }
  async isWithdrawn(id: string) { return await this.bucket.head(await withdrawalKey(id)) !== null; }
}

/** Deterministic integration-test and local-development stores; never bound by production Workers. */
export class MemoryPublishedStore implements PublishedStore {
  releases = new Map<string, Release>(); ancestry = new Map<string, { releaseId: string; previousReleaseId: string | null; operationId: string }>(); withdrawn = new Set<string>(); pointer: ActivePointer | null = null; version = 0;
  async readActive() { return { pointer: this.pointer ? structuredClone(this.pointer) : null, etag: this.pointer ? String(this.version) : null }; }
  async readRelease(id: string) { releaseKey(id); return structuredClone(this.releases.get(id) ?? null); }
  async hasRelease(id: string) { releaseKey(id); return this.releases.has(id); }
  async putRelease(release: Release) { if (!this.releases.has(release.id)) { this.releases.set(release.id, structuredClone(release)); this.ancestry.set(release.id, { releaseId: release.id, previousReleaseId: release.previousReleaseId, operationId: release.operationId }); } }
  async readAncestry(id: string) { return structuredClone(this.ancestry.get(id) ?? null); }
  async compareAndSwapActive(pointer: ActivePointer, expected: string | null) { if (expected !== (this.pointer ? String(this.version) : null)) return false; this.pointer = structuredClone(pointer); this.version++; return true; }
  async listReleaseIds() { return [...this.releases.keys()]; }
  async deleteRelease(id: string) { this.releases.delete(id); }
  async markWithdrawn(id: string) { this.withdrawn.add(id); }
  async isWithdrawn(id: string) { return this.withdrawn.has(id); }
}
export class MemoryPublicationStore implements PublicationStore {
  candidates = new Map<string, Candidate>(); attempts = new Map<string, PublicationAttempt>(); events: AuditEvent[] = [];
  async getCandidate(id: string) { return structuredClone(this.candidates.get(id) ?? null); }
  async putCandidate(value: Candidate) { if (this.candidates.has(value.id)) throw new KnowledgeError('immutable_candidate', 'Candidate already exists.', 409); this.candidates.set(value.id, structuredClone(value)); }
  async getAttempt(id: string) { return structuredClone(this.attempts.get(id) ?? null); }
  async putAttempt(value: PublicationAttempt) { this.attempts.set(value.id, structuredClone(value)); }
  async listAttempts() { return [...this.attempts.values()].map(x => structuredClone(x)); }
  async listPendingAttempts() { return [...this.attempts.values()].filter(x => x.state === 'pending' || (x.state === 'committed' && !x.cleanupComplete)).map(x => structuredClone(x)); }
  async audit(value: AuditEvent) { this.events.push(structuredClone(value)); }
}
