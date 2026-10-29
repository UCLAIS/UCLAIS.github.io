import type { Release } from './types';
import type { PublishedReader } from './storage';

/** No writable binding, network credential, draft store or runtime write method. */
export function bundledStore(release: Release, withdrawnDocumentIds: readonly string[] = []): PublishedReader {
  const withdrawn = new Set(withdrawnDocumentIds);
  const pointer = { releaseId: release.id, hash: release.hash, operationId: release.operationId, previousReleaseId: release.previousReleaseId };
  return {
    readActive: async () => ({ pointer, etag: release.hash }),
    readRelease: async id => id === release.id ? release : null,
    hasRelease: async id => id === release.id,
    isWithdrawn: async id => withdrawn.has(id),
  };
}
