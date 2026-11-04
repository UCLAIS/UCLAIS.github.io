import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertWrite, challenge, LOGIN_COOKIE, ManagementEnv, seal, SESSION_COOKIE, unseal } from '../src/management/auth';
import { Github, knowledgePath, slidePath } from '../src/management/github';
import { handleManagement } from '../src/management/worker';

const env = { MANAGEMENT_ORIGIN: 'https://manage.uclai.co.uk', GITHUB_CLIENT_ID: 'configured-id', GITHUB_CLIENT_SECRET: 'configured-secret', SESSION_SECRET: 'a'.repeat(64), ASSETS: { fetch: vi.fn(async () => new Response('PRIVATE UI')) }, RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) } } as unknown as ManagementEnv;
const session = { token: 'test-token', csrf: 'csrf-test', expires: Date.now() + 60_000 };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('management security boundaries', () => {
  it('encrypts credentials with purpose, tamper and expiry checks', async () => {
    const value = await seal(env, 'session', session);
    expect(value).not.toContain(session.token);
    expect(await unseal(env, 'session', value)).toEqual(session);
    expect(await unseal(env, 'login', value)).toBeNull();
    expect(await unseal(env, 'session', value.slice(0, -3) + 'xyz')).toBeNull();
    expect(await unseal(env, 'session', await seal(env, 'session', { ...session, expires: 1 }))).toBeNull();
    expect(await challenge('verifier')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('gates every private API and static asset without using GitHub before sign-in', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    for (const path of ['/api/library', '/api/status', '/api/slides', '/app.js', '/style.css', '/']) {
      const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + path), env);
      expect(await result.text()).not.toContain('PRIVATE UI');
      expect(result.headers.get('Cache-Control')).toBe('no-store');
      if (path.startsWith('/api/')) expect(result.status).toBe(401);
    }
    expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('requires both live repository write permission and any configured stable-ID restriction', async () => {
    const network = vi.fn(async (url: any) => Response.json(String(url).endsWith('/user') ? { id: 123, login: 'member' } : { permissions: { push: false } }));
    const github = new Github('token', network as typeof fetch);
    await expect(github.actor()).rejects.toMatchObject({ code: 'forbidden' });
    network.mockImplementation(async (url: any) => Response.json(String(url).endsWith('/user') ? { id: 123, login: 'member' } : { permissions: { push: true } }));
    await expect(github.actor('456')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(github.actor('123')).resolves.toMatchObject({ id: 123 });
  });
  it('calls receiver-sensitive network APIs without binding the Github client as this', async () => {
    const network = function(this: unknown, url: RequestInfo | URL) {
      if (this !== undefined) throw new TypeError('Illegal invocation');
      return Promise.resolve(Response.json(String(url).endsWith('/user') ? { id:123, login:'member' } : { permissions:{ push:true } }));
    };
    await expect(new Github('test-token', network as typeof fetch).actor()).resolves.toMatchObject({ id:123, login:'member' });
  });
  it.each(['html', 'json', 'network'])('reports a safe OAuth handoff failure for %s without source/credential fragments', async kind => {
    const value = await seal(env, 'login', { state:'expected', verifier:'verifier', expires:Date.now()+60_000 });
    const network = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      expect(options?.headers).toMatchObject({ 'User-Agent':'UCLAI-Committee' });
      expect(typeof options?.body).toBe('string');
      if (kind === 'network') throw new Error('PRIVATE_UPSTREAM_FRAGMENT');
      return new Response('PRIVATE_UPSTREAM_FRAGMENT', { status:kind === 'json' ? 200 : 403, headers:{ 'Content-Type':'text/html' } });
    });
    vi.stubGlobal('fetch', network);
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/auth/callback?code=test-code&state=expected', { headers:{ Cookie:`${LOGIN_COOKIE}=${value}` } }), env);
    expect(result.status).toBe(502);
    const body = await result.text();
    expect(body).toContain(kind === 'network' ? 'login_network' : 'login_response');
    expect(body).not.toContain('PRIVATE_UPSTREAM_FRAGMENT');
    expect(body).not.toContain(env.GITHUB_CLIENT_SECRET);
  });
  it('completes OAuth and serves an authorised session without exposing the GitHub token', async () => {
    const value = await seal(env, 'login', { state:'expected', verifier:'verifier', expires:Date.now()+60_000 });
    vi.stubGlobal('fetch', function(this:unknown, url:RequestInfo | URL) {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      if (String(url).endsWith('/login/oauth/access_token')) return Promise.resolve(Response.json({ access_token:'known-test-user-token', expires_in:28800 }));
      return Promise.resolve(Response.json(String(url).endsWith('/user') ? { id:123, login:'member' } : { permissions:{ push:true } }));
    });
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/auth/callback?code=test-code&state=expected', { headers:{ Cookie:`${LOGIN_COOKIE}=${value}` } }), env);
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/');
    const cookie = result.headers.get('Set-Cookie')!.match(/__Host-committee-session=([^;]+)/)![1];
    const encrypted = await unseal<{ token:string; expires:number }>(env, 'session', cookie);
    expect(encrypted?.token).toBe('known-test-user-token');
    expect(encrypted!.expires - Date.now()).toBeLessThanOrEqual(3600_000);
    const info = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/api/session', { headers:{ Cookie:`${SESSION_COOKIE}=${cookie}` } }), env);
    expect(info.status).toBe(200);
    const body = await info.text();
    expect(body).toContain('member');
    expect(body).not.toContain('known-test-user-token');
  });
  it('refuses writes from other origins or without the session CSRF token', () => {
    const request = (origin: string, token: string) => new Request(env.MANAGEMENT_ORIGIN + '/api/knowledge', { method: 'POST', headers: { Origin: origin, 'X-CSRF-Token': token, 'Content-Type': 'application/json' } });
    expect(() => assertWrite(request('https://evil.example', session.csrf), env, session)).toThrow();
    expect(() => assertWrite(request(env.MANAGEMENT_ORIGIN, ''), env, session)).toThrow();
    expect(() => assertWrite(request(env.MANAGEMENT_ORIGIN, session.csrf), env, session)).not.toThrow();
  });
  it('does not let content editing address workflows, private files, traversal or arbitrary slides', () => {
    for (const input of ['.github/workflows/deploy.yml', 'knowledge/faqs/../secret.md', 'knowledge/tutorials/.hidden.md', 'knowledge/tutorials/_templates/a.md', 'knowledge/faqs/README.md', 'knowledge/faqs/evil%2f.md', 'knowledge/withdrawn.json']) expect(() => knowledgePath(input)).toThrow();
    expect(knowledgePath('knowledge/nexus/2026-27/session.md')).toBe('knowledge/nexus/2026-27/session.md');
    expect(slidePath('knowledge/nexus/2026-27/session.md')).toBe('knowledge-assets/slides/nexus/2026-27/session/source.pdf');
    expect(() => slidePath('knowledge/faqs/member.md')).toThrow();
  });
  it('rejects stale edits before creating blobs, branches or pull requests', async () => {
    const network = vi.fn(async (url: any) => Response.json(String(url).endsWith('/commits/main') ? { sha: 'b'.repeat(40), commit: { tree: { sha: 'c'.repeat(40) } } } : { truncated: false, tree: [] }));
    await expect(new Github('token', network as typeof fetch).proposal('a'.repeat(40), [{ path: 'knowledge/faqs/test.md', content: '# Test' }], 'Update', 'member')).rejects.toMatchObject({ code: 'stale_base' });
    expect(network.mock.calls).toHaveLength(2);
  });
  it('refuses revoked permissions on an existing session before serving private assets', async () => {
    const value = await seal(env, 'session', session);
    vi.stubGlobal('fetch', vi.fn(async (url: any) => Response.json(String(url).endsWith('/user') ? { id: 123, login: 'member' } : { permissions: { push: false } })));
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/app.js', { headers: { Cookie: `${SESSION_COOKIE}=${value}` } }), env);
    expect(result.status).toBe(403); expect(await result.text()).not.toContain('PRIVATE UI');
    vi.unstubAllGlobals();
  });
  it('rejects OAuth state mismatch and does not exchange the code', async () => {
    const network = vi.fn(); vi.stubGlobal('fetch', network);
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/auth/callback?code=abc&state=attacker'), env);
    expect(result.status).toBe(403); expect(network).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('submits replacement slide metadata without rewriting source notes or other metadata', async () => {
    vi.spyOn(Github.prototype, 'actor').mockResolvedValue({ id: 123, login: 'member', admin: false });
    const canonical = 'knowledge/tutorials/lesson.md';
    const base = 'a'.repeat(40);
    vi.spyOn(Github.prototype, 'snapshot').mockResolvedValue({ commit: base, treeSha: base, entries: [{ path: canonical, sha: base, type: 'blob', mode: '100644' }, { path: canonical.replace('.md', '.meta.json'), sha: base, type: 'blob', mode: '100644' }] });
    vi.spyOn(Github.prototype, 'text').mockResolvedValue(JSON.stringify({ attribution: 'Original author', year: '2026/27', license: 'CC-BY' }));
    const proposal = vi.spyOn(Github.prototype, 'proposal').mockResolvedValue({ number: 99, url: 'https://github.com/UCLAIS/UCLAIS.github.io/pull/99', commit: base });
    const value = await seal(env, 'session', session);
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/api/slides', { method: 'POST', headers: { Cookie: `${SESSION_COOKIE}=${value}`, Origin: env.MANAGEMENT_ORIGIN, 'X-CSRF-Token': session.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: canonical, commit: base, replace: true, pdf: btoa('%PDF-1.4\ntest fixture') }) }), env);
    expect(result.status).toBe(201);
    const changes = proposal.mock.calls[0][1];
    expect(changes).toHaveLength(2);
    expect(changes.some(change => change.path === canonical)).toBe(false);
    expect(JSON.parse(changes[1].content)).toEqual({ attribution: 'Original author', year: '2026/27', license: 'CC-BY', slides: 'knowledge-assets/slides/tutorials/lesson/source.pdf' });
  });
  it('does not silently replace an existing session through the new-deck form', async () => {
    vi.spyOn(Github.prototype, 'actor').mockResolvedValue({ id: 123, login: 'member', admin: false });
    const base = 'a'.repeat(40);
    vi.spyOn(Github.prototype, 'snapshot').mockResolvedValue({ commit: base, treeSha: base, entries: [{ path: 'knowledge/tutorials/lesson.md', sha: base, type: 'blob', mode: '100644' }] });
    const proposal = vi.spyOn(Github.prototype, 'proposal');
    const value = await seal(env, 'session', session);
    const result = await handleManagement(new Request(env.MANAGEMENT_ORIGIN + '/api/slides', { method: 'POST', headers: { Cookie: `${SESSION_COOKIE}=${value}`, Origin: env.MANAGEMENT_ORIGIN, 'X-CSRF-Token': session.csrf, 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'knowledge/tutorials/lesson.md', commit: base, pdf: btoa('%PDF-1.4\ntest fixture') }) }), env);
    expect(result.status).toBe(409); expect(proposal).not.toHaveBeenCalled();
  });
});
