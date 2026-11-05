import { KnowledgeError } from '../types';
import { Github, REPOSITORY, REPO_URL } from './github';

export function proposalNumber(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9][0-9]{0,8}$/.test(String(value))) throw new KnowledgeError('invalid_proposal', 'Choose a valid submission.', 400);
  return Number(value);
}

export async function proposalReview(github: Github, number: number, reviewerId: number) {
  const pr = await github.repo<any>(`/pulls/${number}`);
  if (pr.state !== 'open' || pr.draft === true || pr.base?.ref !== 'main' || pr.base?.repo?.full_name !== REPOSITORY || pr.head?.repo?.full_name !== REPOSITORY || !pr.head?.ref?.startsWith('committee/') || !/^[a-f0-9]{40}$/.test(pr.head?.sha || '') || !Number.isSafeInteger(pr.user?.id)) {
    throw new KnowledgeError('unsupported_proposal', 'Review this pull request on GitHub. This page supports open management submissions to main.', 400);
  }
  if (!Number.isInteger(pr.changed_files) || pr.changed_files < 1 || pr.changed_files > 100) throw new KnowledgeError('large_proposal', 'Review this larger submission on GitHub.', 400);
  const files = await github.repo<any[]>(`/pulls/${number}/files?per_page=100`);
  if (!Array.isArray(files) || files.length !== pr.changed_files) throw new KnowledgeError('incomplete_review', 'The changed files could not be verified. Refresh or review on GitHub.', 502);
  let remaining = 256 * 1024;
  return {
    number, title: String(pr.title), author: String(pr.user.login), head: pr.head.sha as string,
    url: `${REPO_URL}/pull/${number}`, canApprove: pr.user.id !== reviewerId,
    files: files.map(file => {
      const patch = typeof file.patch === 'string' ? file.patch : '';
      const displayed = patch.slice(0, Math.min(remaining, 64 * 1024)); remaining -= displayed.length;
      return { path: String(file.filename), status: String(file.status), patch: displayed,
        limited: !patch || displayed.length !== patch.length,
        url: file.status === 'removed' ? `${REPO_URL}/pull/${number}/files` : `${REPO_URL}/blob/${pr.head.sha}/${String(file.filename).split('/').map(encodeURIComponent).join('/')}` };
    }),
  };
}

export async function approveProposal(github: Github, number: number, head: string, reviewerId: number) {
  const proposal = await proposalReview(github, number, reviewerId);
  if (!proposal.canApprove) throw new KnowledgeError('self_approval', 'Someone else must approve your submission, just as on GitHub.', 403);
  if (proposal.head !== head) throw new KnowledgeError('stale_review', 'This submission changed. Reopen it and review the latest changes before approving.', 409);
  const review = await github.repo<{ id: number; state: string; commit_id: string }>(`/pulls/${number}/reviews`, { method: 'POST', body: { event: 'APPROVE', commit_id: head } });
  if (review.state !== 'APPROVED' || review.commit_id !== head || !Number.isSafeInteger(review.id)) throw new KnowledgeError('approval_unconfirmed', 'GitHub did not confirm the approval. Check the pull request before retrying.', 502);
  return { number, head, url: `${REPO_URL}/pull/${number}#pullrequestreview-${review.id}` };
}
