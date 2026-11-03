import { containsSensitiveText } from '../content-safety';
import { KnowledgeError } from '../types';

export const REPOSITORY = 'UCLAIS/UCLAIS.github.io';
export const REPO_URL = `https://github.com/${REPOSITORY}`;
export interface TreeEntry { path: string; type: string; sha: string; size?: number; mode: string }
export type Network = typeof fetch;
export class Github {
  constructor(private token: string, private network: Network = fetch) {}
  async api<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
    const response = await this.network(`https://api.github.com${path}`, {
      method: options.method || 'GET', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'UCLAI-Committee' },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    if (!response.ok) throw new KnowledgeError('github_unavailable', response.status === 401 ? 'GitHub sign-in expired. Sign out and sign in again.' : response.status === 403 || response.status === 429 ? 'GitHub refused this request. Check repository access or try again later.' : 'GitHub could not complete this request. Refresh before retrying.', response.status === 401 ? 401 : 502);
    return response.status === 204 ? undefined as T : await response.json() as T;
  }
  repo<T = any>(path = '', options: { method?: string; body?: unknown } = {}) { return this.api<T>(`/repos/${REPOSITORY}${path}`, options); }
  async actor(allowedIds?: string) {
    const [user, repo] = await Promise.all([this.api<{ id: number; login: string }>('/user'), this.repo<{ permissions?: { push?: boolean; maintain?: boolean; admin?: boolean } }>()]);
    const allowed = (allowedIds || '').split(',').map(value => value.trim()).filter(Boolean);
    if (!Number.isSafeInteger(user.id) || !user.login || !repo.permissions?.push || (allowed.length && !allowed.includes(String(user.id)))) throw new KnowledgeError('forbidden', 'This GitHub account needs write access to the society website repository.', 403);
    return { id: user.id, login: user.login, admin: repo.permissions.admin === true };
  }
  async snapshot() {
    const commit = await this.repo<{ sha: string; commit: { tree: { sha: string } } }>('/commits/main');
    const tree = await this.repo<{ tree: TreeEntry[]; truncated: boolean }>(`/git/trees/${commit.commit.tree.sha}?recursive=1`);
    if (tree.truncated) throw new KnowledgeError('repository_too_large', 'GitHub returned an incomplete file list.', 502);
    return { commit: commit.sha, treeSha: commit.commit.tree.sha, entries: tree.tree };
  }
  async text(entry: TreeEntry) {
    if (entry.type !== 'blob' || entry.mode !== '100644' || (entry.size || 0) > 512 * 1024) throw new KnowledgeError('unsupported_file', 'This file cannot be edited here.', 400);
    const blob = await this.repo<{ content: string; encoding: string }>(`/git/blobs/${entry.sha}`);
    if (blob.encoding !== 'base64') throw new KnowledgeError('unsupported_file', 'Unexpected GitHub file encoding.', 502);
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(blob.content.replace(/\s/g, '')), char => char.charCodeAt(0)));
  }
  async proposal(baseCommit: string, changes: { path: string; content: string; encoding?: 'utf-8' | 'base64' }[], title: string, login: string) {
    const current = await this.snapshot();
    if (baseCommit !== current.commit) throw new KnowledgeError('stale_base', 'The repository changed since you opened this form. Reload it before submitting.', 409);
    const blobs = [];
    for (const change of changes) {
      const blob = await this.repo<{ sha: string }>('/git/blobs', { method: 'POST', body: { content: change.content, encoding: change.encoding || 'utf-8' } });
      blobs.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await this.repo<{ sha: string }>('/git/trees', { method: 'POST', body: { base_tree: current.treeSha, tree: blobs } });
    const commit = await this.repo<{ sha: string }>('/git/commits', { method: 'POST', body: { message: title, tree: tree.sha, parents: [baseCommit] } });
    const branch = `committee/${crypto.randomUUID()}`;
    await this.repo('/git/refs', { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
    // A failure here leaves a recoverable branch; never auto-retry a content mutation.
    try {
      const pr = await this.repo<{ html_url: string; number: number }>('/pulls', { method: 'POST', body: { title, head: branch, base: 'main', body: `Submitted through Society Management by @${login}.\n\nReview the material and automated website/knowledge checks before merging. Both deployments must complete before the change is fully published.` } });
      return { url: pr.html_url, number: pr.number, commit: commit.sha };
    } catch { throw new KnowledgeError('proposal_incomplete', `Files were saved to ${branch}, but GitHub did not confirm a pull request. Open the repository's branch list to recover it before submitting again.`, 502); }
  }
}

export function knowledgePath(input: unknown): string {
  if (typeof input !== 'string' || input.length > 240 || !/^knowledge\/(faqs|guides|tutorials|nexus)\/[a-zA-Z0-9][a-zA-Z0-9_./-]*\.md$/.test(input) || input.split('/').some(part => !part || part.startsWith('.') || part.startsWith('_') || part === 'README.md')) throw new KnowledgeError('invalid_path', 'Use a Markdown path inside knowledge/faqs, guides, tutorials or nexus.', 400);
  return input;
}
export function safeText(value: unknown, maximum = 512 * 1024): string {
  if (typeof value !== 'string' || !value.trim() || new TextEncoder().encode(value).length > maximum || value.includes('\0')) throw new KnowledgeError('invalid_content', 'Provide non-empty text within the file limit.', 400);
  if (containsSensitiveText(value)) throw new KnowledgeError('sensitive_content', 'Remove credential-like content before submitting.', 400);
  return value;
}
export function slidePath(sourcePath: string): string {
  knowledgePath(sourcePath);
  if (!/^knowledge\/(tutorials|nexus)\//.test(sourcePath)) throw new KnowledgeError('invalid_path', 'Slides belong to a tutorial or Nexus session.', 400);
  return `knowledge-assets/slides/${sourcePath.slice('knowledge/'.length, -3)}/source.pdf`;
}
