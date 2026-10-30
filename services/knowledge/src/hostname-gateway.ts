// Pages supports an IONOS-managed subdomain without moving the parent DNS zone.
// The only backend is the existing public Worker, reached through a service binding.
const upstreamOrigin = 'https://uclai-knowledge-public-staging.uclai-society.workers.dev';
const hosts = new Set(['mcp.uclai.co.uk', 'uclai-mcp.pages.dev']);
const requestHeaders = ['accept', 'content-type', 'origin', 'mcp-protocol-version', 'mcp-session-id', 'last-event-id', 'cf-connecting-ip'];
const responseHeaders = ['content-type', 'mcp-session-id', 'mcp-protocol-version', 'retry-after', 'allow', 'access-control-allow-origin', 'access-control-allow-methods', 'access-control-allow-headers', 'access-control-expose-headers', 'vary'];
const maxBodyBytes = 65_536;

export interface HostnameEnvironment {
  PUBLIC_KNOWLEDGE: { fetch(request: Request): Promise<Response> };
}

function failure(status: number): Response {
  return Response.json({ error: status === 503 ? 'unavailable' : 'request_rejected', contact: 'info@uclai.co.uk' }, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

function publicPath(path: string): boolean {
  return ['/mcp', '/health', '/api/search', '/api/events', '/api/paths'].includes(path)
    || /^\/api\/(?:resources|paths)\/[^/]+$/.test(path);
}

async function boundedBody(request: Request, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) { await reader.cancel(); throw new Error('oversized'); }
      chunks.push(value);
    }
  } finally { signal.removeEventListener('abort', abort); reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

export default {
  async fetch(request: Request, env: HostnameEnvironment): Promise<Response> {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || !hosts.has(url.host) || url.username || url.password || url.href.length > 4096) return failure(403);
    if (url.pathname === '/' && request.method === 'GET') return new Response(null, { status: 302, headers: { Location: 'https://uclai.co.uk/connect/', 'Cache-Control': 'no-store' } });
    if (!publicPath(url.pathname)) return failure(404);
    if (!['GET', 'POST', 'DELETE', 'OPTIONS'].includes(request.method) || (['POST', 'DELETE'].includes(request.method) && url.pathname !== '/mcp')) return failure(405);
    if (!env.PUBLIC_KNOWLEDGE?.fetch) return failure(503);
    if (request.headers.has('Content-Encoding') && request.headers.get('Content-Encoding') !== 'identity') return failure(415);
    const declaredLength = request.headers.get('Content-Length');
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBodyBytes)) return failure(413);
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
    let body: Uint8Array<ArrayBuffer> | undefined;
    try { if (request.body) body = await boundedBody(request, signal); } catch { return failure(413); }
    try {
      const headers = new Headers();
      for (const name of requestHeaders) { const value = request.headers.get(name); if (value !== null) headers.set(name, value); }
      // Credentials, cookies, forwarding overrides and arbitrary destination headers
      // never enter the backend. Its existing Origin, tool and rate checks still apply.
      const upstream = await env.PUBLIC_KNOWLEDGE.fetch(new Request(`${upstreamOrigin}${url.pathname}${url.search}`, { method: request.method, headers, body, redirect: 'manual', signal }));
      if (upstream.status >= 300 && upstream.status < 400) { await upstream.body?.cancel(); return failure(502); }
      const outgoing = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      for (const name of responseHeaders) { const value = upstream.headers.get(name); if (value !== null) outgoing.set(name, value); }
      return new Response(upstream.body, { status: upstream.status, headers: outgoing });
    } catch { return failure(503); }
  },
};
