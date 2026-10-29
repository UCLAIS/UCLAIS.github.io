import type { Actor, Candidate, Draft, Role } from './types';
import { KnowledgeError } from './types';
import type { AuditEvent, PublicationAttempt, PublicationStore } from './storage';
import { randomToken, sha256, SESSION_SECONDS } from './browser';

const now = () => Math.floor(Date.now() / 1000);
const validId = (value: string) => /^[a-zA-Z0-9_-]{1,100}$/.test(value);
export const validGithubId = (value: string) => /^[1-9][0-9]{0,19}$/.test(value);
export type BrowserSession = { githubId: string; csrf: string; sessionHash: string };
export type Approval = { id: string; githubId: string; sessionHash: string; candidateId: string; candidateHash: string; baseReleaseId: string | null; action: string };

export class D1PrivateStore implements PublicationStore {
  constructor(readonly db: D1Database, readonly bucket?: R2Bucket) {}
  private objects(): R2Bucket {
    if (!this.bucket) throw new KnowledgeError('storage_unavailable', 'Private object storage is unavailable', 503);
    return this.bucket;
  }

  async actor(githubId: string): Promise<Actor | null> {
    if (!validGithubId(githubId)) return null;
    const row = await this.db.prepare('SELECT role FROM maintainers WHERE github_id = ?').bind(githubId).first<{ role: Role }>();
    return row ? { githubId, role: row.role } : null;
  }

  async maintainers() {
    return (await this.db.prepare('SELECT github_id AS githubId, role, updated_at AS updatedAt FROM maintainers ORDER BY github_id').all()).results;
  }

  async setMaintainer(githubId: string, role: Role | null, actor: Actor) {
    if (actor.role !== 'admin' || !validGithubId(githubId)) throw new KnowledgeError('forbidden', 'Administrator permission required', 403);
    const existing = await this.actor(githubId);
    const at = new Date().toISOString();
    if (existing?.role === 'admin' && role !== 'admin') {
      const result = role === null
        ? await this.db.prepare("DELETE FROM maintainers WHERE github_id = ? AND (SELECT COUNT(*) FROM maintainers WHERE role = 'admin') > 1").bind(githubId).run()
        : await this.db.prepare("UPDATE maintainers SET role = ?, updated_by = ?, updated_at = ? WHERE github_id = ? AND (SELECT COUNT(*) FROM maintainers WHERE role = 'admin') > 1").bind(role, actor.githubId, at, githubId).run();
      if (!result.meta.changes) throw new KnowledgeError('last_admin', 'Keep at least one administrator', 409);
    } else if (role === null) {
      await this.db.prepare('DELETE FROM maintainers WHERE github_id = ?').bind(githubId).run();
    } else {
      await this.db.prepare('INSERT INTO maintainers(github_id,role,updated_by,updated_at) VALUES(?,?,?,?) ON CONFLICT(github_id) DO UPDATE SET role=excluded.role,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(githubId, role, actor.githubId, at).run();
    }
    await this.audit({ action: 'maintainer_changed', actorId: actor.githubId, targetId: githubId, at, detail: role || 'removed' });
  }

  async getDraft(id: string): Promise<Draft | null> {
    if (!validId(id)) return null;
    const row = await this.db.prepare('SELECT object_key FROM drafts WHERE id = ?').bind(id).first<{ object_key: string }>();
    if (!row) return null;
    const object = await this.objects().get(row.object_key);
    if (!object) throw new KnowledgeError('draft_unavailable', 'Draft data is unavailable', 503);
    return object.json<Draft>();
  }

  async listDrafts() {
    return (await this.db.prepare('SELECT id, revision, base_release_id AS baseReleaseId, updated_by AS updatedBy, updated_at AS updatedAt FROM drafts ORDER BY updated_at DESC LIMIT 100').all()).results;
  }

  async saveDraft(value: Draft, expectedRevision: number | null): Promise<Draft> {
    if (!validId(value.id) || value.revision !== (expectedRevision ?? 0) + 1) throw new KnowledgeError('invalid_revision', 'Invalid draft revision', 400);
    const objectKey = `drafts/${value.id}/${value.revision}-${randomToken()}.json`;
    await this.objects().put(objectKey, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
    try {
      if (expectedRevision === null) {
        await this.db.prepare('INSERT INTO drafts(id,revision,object_key,base_release_id,updated_by,updated_at) VALUES(?,?,?,?,?,?)').bind(value.id, value.revision, objectKey, value.baseReleaseId, value.updatedBy, value.updatedAt).run();
      } else {
        const result = await this.db.prepare('UPDATE drafts SET revision=?,object_key=?,updated_by=?,updated_at=? WHERE id=? AND revision=?').bind(value.revision, objectKey, value.updatedBy, value.updatedAt, value.id, expectedRevision).run();
        if (!result.meta.changes) throw new KnowledgeError('draft_conflict', 'Draft changed; fetch the current revision', 409);
      }
    } catch (error) {
      await this.objects().delete(objectKey);
      if (error instanceof KnowledgeError) throw error;
      throw new KnowledgeError('draft_conflict', 'Draft already exists or changed', 409);
    }
    return value;
  }

  async getCandidate(id: string): Promise<Candidate | null> {
    if (!validId(id)) return null;
    const row = await this.db.prepare('SELECT object_key FROM candidates WHERE id = ?').bind(id).first<{ object_key: string }>();
    if (!row) return null;
    const object = await this.objects().get(row.object_key);
    if (!object) throw new KnowledgeError('candidate_unavailable', 'Candidate data is unavailable', 503);
    return object.json<Candidate>();
  }

  async putCandidate(candidate: Candidate): Promise<void> {
    if (!validId(candidate.id)) throw new KnowledgeError('invalid_candidate', 'Invalid candidate ID');
    const objectKey = `candidates/${candidate.id}.json`;
    const created = await this.objects().put(objectKey, JSON.stringify(candidate), { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/json' } });
    if (!created) throw new KnowledgeError('immutable_candidate', 'Candidate already exists', 409);
    await this.db.prepare('INSERT INTO candidates(id,hash,object_key,draft_id,draft_revision,created_at) VALUES(?,?,?,?,?,?)').bind(candidate.id, candidate.hash, objectKey, candidate.draftId, candidate.draftRevision, candidate.createdAt).run();
  }

  async getAttempt(id: string): Promise<PublicationAttempt | null> {
    const row = await this.db.prepare('SELECT payload FROM publication_attempts WHERE id = ?').bind(id).first<{ payload: string }>();
    return row ? JSON.parse(row.payload) : null;
  }
  async putAttempt(value: PublicationAttempt): Promise<void> {
    const written = await this.db.prepare(`INSERT INTO publication_attempts(id,payload,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET
      payload=CASE WHEN json_extract(publication_attempts.payload,'$.state')='committed'
        AND (json_extract(excluded.payload,'$.state')!='committed' OR COALESCE(json_extract(publication_attempts.payload,'$.cleanupComplete'),0)=1)
        THEN publication_attempts.payload ELSE excluded.payload END,
      updated_at=excluded.updated_at
      WHERE json_extract(publication_attempts.payload,'$.actorId')=json_extract(excluded.payload,'$.actorId')
        AND json_extract(publication_attempts.payload,'$.candidateId')=json_extract(excluded.payload,'$.candidateId')
        AND json_extract(publication_attempts.payload,'$.candidateHash')=json_extract(excluded.payload,'$.candidateHash')
        AND json_extract(publication_attempts.payload,'$.releaseId')=json_extract(excluded.payload,'$.releaseId')`).bind(value.id, JSON.stringify(value), new Date().toISOString()).run();
    if (!written.meta.changes) throw new KnowledgeError('operation_mismatch', 'Publication operation belongs to another request', 409);
  }
  async listAttempts(): Promise<PublicationAttempt[]> {
    const rows = await this.db.prepare('SELECT payload FROM publication_attempts ORDER BY updated_at DESC LIMIT 100').all<{ payload: string }>();
    return rows.results.map(row => JSON.parse(row.payload));
  }
  async listPendingAttempts(): Promise<PublicationAttempt[]> {
    const rows = await this.db.prepare("SELECT payload FROM publication_attempts WHERE json_extract(payload,'$.state')='pending' OR (json_extract(payload,'$.state')='committed' AND COALESCE(json_extract(payload,'$.cleanupComplete'),0) != 1) ORDER BY updated_at ASC").all<{ payload: string }>();
    return rows.results.map(row => JSON.parse(row.payload));
  }
  async audit(event: AuditEvent): Promise<void> {
    await this.db.prepare('INSERT INTO audit_events(event,created_at) VALUES(?,?)').bind(JSON.stringify(event), event.at).run();
  }

  async putTransaction(token: string, kind: string, payload: unknown, lifetime: number): Promise<void> {
    await this.db.prepare('INSERT INTO auth_transactions(token_hash,kind,payload,expires_at) VALUES(?,?,?,?)').bind(await sha256(token), kind, JSON.stringify(payload), now() + lifetime).run();
  }
  async consumeTransaction<T>(token: string, kind: string): Promise<T | null> {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const row = await this.db.prepare('DELETE FROM auth_transactions WHERE token_hash=? AND kind=? AND expires_at>? RETURNING payload').bind(await sha256(token), kind, now()).first<{ payload: string }>();
    return row ? JSON.parse(row.payload) : null;
  }

  async createSession(githubId: string): Promise<string> {
    const token = randomToken();
    await this.db.prepare('INSERT INTO browser_sessions(token_hash,github_id,csrf_hash,expires_at) VALUES(?,?,?,?)').bind(await sha256(token), githubId, await sha256(await sha256(`csrf:${token}`)), now() + SESSION_SECONDS).run();
    return token;
  }
  async session(token: string): Promise<BrowserSession | null> {
    const sessionHash = await sha256(token);
    const row = await this.db.prepare('SELECT github_id,csrf_hash FROM browser_sessions WHERE token_hash=? AND expires_at>?').bind(sessionHash, now()).first<{ github_id: string; csrf_hash: string }>();
    const csrf = await sha256(`csrf:${token}`);
    return row && await sha256(csrf) === row.csrf_hash ? { githubId: row.github_id, csrf, sessionHash } : null;
  }
  async deleteSession(token: string): Promise<void> {
    await this.db.prepare('DELETE FROM browser_sessions WHERE token_hash=?').bind(await sha256(token)).run();
  }

  async createApproval(session: BrowserSession, candidate: Candidate, action: string): Promise<string> {
    const id = randomToken();
    await this.db.prepare('INSERT INTO approvals(id,github_id,session_hash,candidate_id,candidate_hash,base_release_id,action,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, session.githubId, session.sessionHash, candidate.id, candidate.hash, candidate.baseReleaseId, action, now() + 600).run();
    return id;
  }
  async consumeApproval(id: string, session: BrowserSession): Promise<Approval | null> {
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    const row = await this.db.prepare('UPDATE approvals SET consumed_at=? WHERE id=? AND github_id=? AND session_hash=? AND expires_at>? AND consumed_at IS NULL RETURNING id, github_id AS githubId, session_hash AS sessionHash, candidate_id AS candidateId, candidate_hash AS candidateHash, base_release_id AS baseReleaseId, action').bind(now(), id, session.githubId, session.sessionHash, now()).first<Approval>();
    return row || null;
  }
  async approvalForRetry(id: string, session: BrowserSession): Promise<Approval | null> {
    if (!/^[a-f0-9]{64}$/.test(id) || !await this.getAttempt(id)) return null;
    return this.db.prepare('SELECT id,github_id AS githubId,session_hash AS sessionHash,candidate_id AS candidateId,candidate_hash AS candidateHash,base_release_id AS baseReleaseId,action FROM approvals WHERE id=? AND github_id=? AND session_hash=? AND expires_at>? AND consumed_at IS NOT NULL').bind(id, session.githubId, session.sessionHash, now()).first<Approval>();
  }
  async rateLimit(key: string, maximum: number): Promise<void> {
    const window = Math.floor(now() / 60);
    const row = await this.db.prepare('INSERT INTO request_limits(key,window,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window=excluded.window THEN count+1 ELSE 1 END,window=excluded.window RETURNING count').bind(await sha256(key), window).first<{ count: number }>();
    if (!row || row.count > maximum) throw new KnowledgeError('rate_limited', 'Too many requests; retry in a minute', 429);
  }
  async cleanup(): Promise<void> {
    await this.db.batch([
      this.db.prepare('DELETE FROM auth_transactions WHERE expires_at < ?').bind(now()),
      this.db.prepare('DELETE FROM browser_sessions WHERE expires_at < ?').bind(now()),
      this.db.prepare('DELETE FROM approvals WHERE expires_at < ?').bind(now()),
      this.db.prepare('DELETE FROM request_limits WHERE window < ?').bind(Math.floor(now() / 60) - 60),
    ]);
  }
}
