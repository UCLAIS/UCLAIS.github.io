import snapshot from '../.generated/knowledge.release.json';
import { createPublicHandler } from './public-worker';
import { bundledStore } from './bundled-store';
import { LumaCalendar } from './luma';
import type { Release } from './types';
import { publicGuidance } from './guidance';

export interface BundledEnvironment {
  PUBLIC_ORIGIN: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
const { release, withdrawnDocumentIds } = snapshot as { release: Release; withdrawnDocumentIds: string[] };
// Only the approved generated snapshot is bundled. Startup loads the index once;
// requests never fetch GitHub, write storage, or trigger a build/deployment.
const handler = createPublicHandler(bundledStore(release, withdrawnDocumentIds), new LumaCalendar(fetch, {
  match: request => (caches as CacheStorage & { default: Cache }).default.match(request),
  put: (request, response) => (caches as CacheStorage & { default: Cache }).default.put(request, response),
}), release);

export default {
  async fetch(request: Request, env: BundledEnvironment): Promise<Response> {
    const unavailable = () => Response.json({ error: 'unavailable', message: 'Knowledge is temporarily unavailable.', guidance: publicGuidance }, { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    if (!env.PUBLIC_ORIGIN || !/^https:\/\//.test(env.PUBLIC_ORIGIN) || !env.RATE_LIMITER) return unavailable();
    try {
      const limit = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'anonymous' });
      if (!limit.success) return Response.json({ error: 'rate_limited', message: 'Please try again later.', guidance: publicGuidance }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60', 'X-Content-Type-Options': 'nosniff' } });
      return await handler(request, env);
    } catch { return unavailable(); }
  },
};
