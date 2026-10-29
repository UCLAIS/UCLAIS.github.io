import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHarness, AUTH, ADMIN, CookieJar, token, GITHUB_ID, rpcBody } from './auth-harness';

describe('real OAuth provider and GitHub identity in workerd', () => {
  let h: Awaited<ReturnType<typeof authHarness>>;
  beforeAll(async () => { h = await authHarness(); }, 60_000);
  afterAll(async () => { await h?.mf.dispose(); });

  it('publishes OAuth discovery with S256 and the correct issuer', async () => {
    const response = await h.sendAuth('/.well-known/oauth-authorization-server');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.issuer).toBe(AUTH);
    expect(body.code_challenge_methods_supported).toContain('S256');
    expect(body.client_id_metadata_document_supported).toBe(true);
  });

  it('escapes untrusted client names and binds consent to the browser', async () => {
    const flow = await h.startAuthorization();
    expect(flow.html).toContain('&lt;script&gt;');
    expect(flow.html).not.toContain('client <script>');
    const response = await h.sendAuth('/consent', { method: 'POST', headers: { Origin: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: flow.handle, decision: 'allow' }) });
    expect([400, 403]).toContain(response.status);
  });

  it('rejects redirect substitution and missing PKCE', async () => {
    const flow = await h.startAuthorization();
    const redirect = new URLSearchParams(flow.params); redirect.set('redirect_uri', 'https://attacker.example/callback');
    const rejected = await h.sendAuth(`/authorize?${redirect}`);
    expect(rejected.status).toBe(400);
    expect(rejected.headers.get('Location')).toBeNull();
    const noPkce = new URLSearchParams(flow.params); noPkce.delete('code_challenge'); noPkce.delete('code_challenge_method');
    const invalid = await h.sendAuth(`/authorize?${noPkce}`);
    expect([302, 400]).toContain(invalid.status);
    if (invalid.headers.has('Location')) expect(new URL(invalid.headers.get('Location')!).searchParams.has('error')).toBe(true);
  });

  it('rejects a GitHub callback without its browser-bound upstream state', async () => {
    const response = await h.sendAuth('/github/callback?state=stolen&code=test-code-57414242');
    expect([400, 403]).toContain(response.status);
    expect(await response.text()).not.toContain('access_token');
  });

  it('does not authorise an arbitrary signed-in GitHub account', async () => {
    const flow = await h.authorizationCode('999999');
    expect(flow.callback.status).toBe(403);
    expect(await flow.callback.text()).toContain('not_a_maintainer');
  });

  it('issues an audience-bound editor token through real PKCE and rejects code replay', async () => {
    const credentials = await h.getToken();
    const response = await h.rpc(credentials.access_token, 'tools/list');
    expect(response.status).toBe(200);
    const body = await rpcBody(response);
    expect(body.result.tools.some((tool: any) => tool.name === 'prepare_release')).toBe(true);
    expect(body.result.tools.some((tool: any) => /^(publish|rollback|withdraw|manage_maintainers)$/.test(tool.name))).toBe(false);
    const replay = await h.sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(credentials.form) });
    expect(replay.status).toBe(400);
    const binding = await h.mf.getBindings<any>('admin');
    await expect(Promise.resolve().then(() => binding.AUTH_SERVER.validateToken('https://other.example/mcp', credentials.access_token))).rejects.toThrow('registered protected resource');
    // The provider revokes the grant after detecting authorization-code replay.
    expect(await binding.AUTH_SERVER.validateToken(`${ADMIN}/mcp`, credentials.access_token)).toBeNull();
  });

  it('rejects a bad PKCE verifier', async () => {
    const flow = await h.authorizationCode();
    const code = new URL(flow.callback.headers.get('Location')!).searchParams.get('code')!;
    const response = await h.sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: flow.client, redirect_uri: 'https://client.example/callback', code_verifier: token(), resource: `${ADMIN}/mcp` }) });
    expect(response.status).toBe(400);
  });

  it('rotates refresh tokens and rejects credentials older than the provider overlap slot', async () => {
    const credentials = await h.getToken();
    const form = { grant_type: 'refresh_token', refresh_token: credentials.refresh_token, client_id: credentials.client, resource: `${ADMIN}/mcp` };
    const refreshed = await h.sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
    expect(refreshed.status).toBe(200);
    const newer = (await refreshed.json() as any).refresh_token;
    expect(newer).not.toBe(credentials.refresh_token);
    const again = await h.sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...form, refresh_token: newer }) });
    expect(again.status).toBe(200);
    const replay = await h.sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
    expect(replay.status).toBe(400);
  });

  it('rejects expired and tampered access tokens', async () => {
    const credentials = await h.getToken();
    const invalid = await h.rpc(`${credentials.access_token}tampered`, 'tools/list');
    expect(invalid.status).toBe(401);
    const kv = await h.mf.getKVNamespace('OAUTH_KV', 'auth');
    const keys = await kv.list({ prefix: `token:${GITHUB_ID}:` });
    for (const key of keys.keys) {
      const record = await kv.get(key.name, 'json') as { expiresAt: number } | null;
      if (record) { record.expiresAt = Math.floor(Date.now() / 1000) - 100; await kv.put(key.name, JSON.stringify(record)); }
    }
    const expired = await h.rpc(credentials.access_token, 'tools/list');
    expect(expired.status).toBe(401);
  });

  it('binds browser login tickets to the initiating admin cookie', async () => {
    const adminJar = new CookieJar(); const authJar = new CookieJar();
    const start = await h.sendAdmin('/login'); adminJar.take(start);
    const upstream = await h.sendAuth(start.headers.get('Location')!); authJar.take(upstream);
    const state = new URL(upstream.headers.get('Location')!).searchParams.get('state')!;
    const callback = await h.sendAuth(`/github/callback?${new URLSearchParams({ state, code: `test-code-${GITHUB_ID}` })}`, { headers: { Cookie: authJar.header() } });
    expect(callback.status).toBe(302);
    const handoff = callback.headers.get('Location')!;
    const missing = await h.sendAdmin(handoff);
    expect(missing.status).toBe(403);
    const completed = await h.sendAdmin(handoff, { headers: { Cookie: adminJar.header() } });
    expect(completed.status).toBe(302);
    expect(completed.headers.get('Set-Cookie')).toContain('__Host-aisoc-review=');
    expect(completed.headers.get('Set-Cookie')).toContain('HttpOnly');
    const replay = await h.sendAdmin(handoff, { headers: { Cookie: adminJar.header() } });
    expect(replay.status).toBe(403);
  });
});
