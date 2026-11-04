// Separate from the read-only MCP gateway. The management Worker performs every access check.
export default {
  async fetch(request: Request, env: { MANAGEMENT: Fetcher }): Promise<Response> {
    if (!env.MANAGEMENT) return new Response('Management is unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    return env.MANAGEMENT.fetch(request);
  },
};
