import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';

export const AUTH = 'https://auth.example';
export const ADMIN = 'https://admin.example';
export const GITHUB_ID = '57414242';
export async function rpcBody(response: Response): Promise<any> {
  const text = await response.text();
  if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const rows = text.split('\n').filter(line => line.startsWith('data: '));
    return JSON.parse(rows.at(-1)!.slice(6));
  }
  return JSON.parse(text);
}
export const token = () => randomBytes(32).toString('hex');
export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const challenge = (value: string) => createHash('sha256').update(value).digest('base64url');

export class CookieJar {
  values = new Map<string, string>();
  take(response: Response) {
    const values = response.headers.getSetCookie?.() ?? [response.headers.get('Set-Cookie') || ''];
    for (const value of values) {
      const pair = value.split(';')[0]; const equals = pair.indexOf('=');
      if (equals > 0) this.values.set(pair.slice(0, equals), pair.slice(equals + 1));
    }
  }
  header() { return [...this.values].map(([name, value]) => `${name}=${value}`).join('; '); }
}

async function bundle(entry: string) {
  return (await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', conditions: ['workerd', 'worker', 'browser'], external: ['cloudflare:workers', 'node:*'], logLevel: 'silent' })).outputFiles[0].text;
}

export async function authHarness() {
  const [authScript, adminScript] = await Promise.all([bundle('src/auth-worker.ts'), bundle('src/admin-worker.ts')]);
  const mf = new Miniflare(convertV4MiniflareOptions({
    workers: [
      { name: 'auth', modules: true, script: authScript, compatibilityDate: '2026-10-29', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], kvNamespaces: { OAUTH_KV: 'oauth' }, d1Databases: { PRIVATE_DB: 'private' }, bindings: { AUTH_ORIGIN: AUTH, ADMIN_ORIGIN: ADMIN, GITHUB_CLIENT_ID: 'github-test-client', GITHUB_CLIENT_SECRET: 'test-only-github-secret' }, outboundService: 'github-mock' },
      { name: 'admin', modules: true, script: adminScript, compatibilityDate: '2026-10-29', compatibilityFlags: ['nodejs_compat'], d1Databases: { PRIVATE_DB: 'private' }, r2Buckets: { PRIVATE_BUCKET: 'private-objects', PUBLISHED_BUCKET: 'published' }, bindings: { AUTH_ORIGIN: AUTH, ADMIN_ORIGIN: ADMIN, ALLOWED_MCP_ORIGINS: 'https://chatgpt.com,https://claude.ai' }, serviceBindings: { AUTH_SERVER: 'auth' } },
      { name: 'test-router', modules: true, serviceBindings: { AUTH: 'auth', ADMIN: 'admin' }, script: `export default { async fetch(request,env) { const headers=new Headers(request.headers); const origin=headers.get('X-Test-Origin'); headers.delete('X-Test-Origin'); if(origin!==null) headers.set('Origin',origin); const target=new URL(request.url).hostname==='auth.example'?env.AUTH:env.ADMIN; return target.fetch(new Request(request,{headers,redirect:'manual'})); }};` },
      { name: 'github-mock', modules: true, script: `export default { async fetch(request) {
          const url=new URL(request.url);
          if(url.hostname==='github.com' && url.pathname==='/login/oauth/access_token') {
            const data=await request.formData();
            const code=String(data.get('code')||'');
            if(!/^test-code-[0-9]+$/.test(code)||!data.get('code_verifier')||data.get('client_secret')!=='test-only-github-secret') return Response.json({error:'bad_verification_code'});
            return Response.json({access_token:'test-upstream-'+code.slice(10),token_type:'bearer'});
          }
          if(url.hostname==='api.github.com' && url.pathname==='/user') {
            const id=Number((request.headers.get('Authorization')||'').replace('Bearer test-upstream-',''));
            return Response.json({id,type:'User',login:'identity-name-is-not-used'});
          }
          return new Response('Unexpected outbound request blocked',{status:502});
        }};` },
    ],
  }));
  const db = await mf.getD1Database('PRIVATE_DB', 'admin');
  for (const file of (await readdir('migrations')).filter(value => value.endsWith('.sql')).sort()) {
    const migration = await readFile(`migrations/${file}`, 'utf8');
    for (const statement of migration.split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  const router = await mf.getWorker('test-router');
  // Miniflare's localhost proxy rejects remote Origin headers itself. Reconstruct
  // the test Origin inside a separate fixture Worker before calling production code.
  const send = async (path: string, origin: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    if (headers.has('Origin')) { headers.set('X-Test-Origin', headers.get('Origin')!); headers.delete('Origin'); }
    return await router.fetch(new URL(path, origin).toString(), { ...init, headers, redirect: 'manual' } as any) as unknown as Response;
  };
  const sendAuth = (path: string, init?: RequestInit) => send(path, AUTH, init);
  const sendAdmin = (path: string, init?: RequestInit) => send(path, ADMIN, init);

  async function registerClient() {
    const response = await sendAuth('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'Security test client <script>', redirect_uris: ['https://client.example/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }) });
    const value = await response.json() as { client_id: string };
    if (response.status !== 201 || !value.client_id) throw new Error(`Registration failed: ${response.status} ${JSON.stringify(value)}`);
    return value.client_id;
  }
  async function startAuthorization(clientId?: string) {
    const client = clientId ?? await registerClient();
    const verifier = token();
    const jar = new CookieJar();
    const params = new URLSearchParams({ client_id: client, response_type: 'code', redirect_uri: 'https://client.example/callback', scope: 'knowledge:edit offline_access', state: 'client-state', resource: `${ADMIN}/mcp`, code_challenge: challenge(verifier), code_challenge_method: 'S256' });
    const response = await sendAuth(`/authorize?${params}`); jar.take(response);
    const html = await response.text();
    const handle = html.match(/name="handle" value="([^"]+)"/)?.[1];
    if (response.status !== 200 || !handle) throw new Error(`Consent failed: ${response.status} ${html}`);
    return { client, verifier, jar, html, handle, params };
  }
  async function authorizationCode(githubId = GITHUB_ID) {
    const flow = await startAuthorization();
    const approved = await sendAuth('/consent', { method: 'POST', headers: { Cookie: flow.jar.header(), Origin: AUTH, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ handle: flow.handle, decision: 'allow' }) }); flow.jar.take(approved);
    if (approved.status !== 302) throw new Error(`Upstream redirect failed: ${approved.status} ${await approved.text()}`);
    const state = new URL(approved.headers.get('Location')!).searchParams.get('state')!;
    const callback = await sendAuth(`/github/callback?${new URLSearchParams({ state, code: `test-code-${githubId}` })}`, { headers: { Cookie: flow.jar.header() } });
    return { ...flow, callback, state };
  }
  async function getToken(githubId = GITHUB_ID) {
    const flow = await authorizationCode(githubId);
    if (flow.callback.status !== 302) throw new Error(`GitHub callback failed: ${flow.callback.status} ${await flow.callback.text()}`);
    const location = new URL(flow.callback.headers.get('Location')!);
    const code = location.searchParams.get('code')!;
    const form = { grant_type: 'authorization_code', code, client_id: flow.client, redirect_uri: 'https://client.example/callback', code_verifier: flow.verifier, resource: `${ADMIN}/mcp` };
    const response = await sendAuth('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
    const credentials = await response.json() as { access_token: string; refresh_token: string };
    if (response.status !== 200 || !credentials.access_token) throw new Error(`Token failed: ${response.status} ${JSON.stringify(credentials)}`);
    return { ...credentials, client: flow.client, code, form };
  }
  async function session(githubId = GITHUB_ID) {
    const secret = token(); const csrf = hash(`csrf:${secret}`);
    await db.prepare('INSERT INTO browser_sessions(token_hash,github_id,csrf_hash,expires_at) VALUES(?,?,?,?)').bind(hash(secret), githubId, hash(csrf), Math.floor(Date.now() / 1000) + 3600).run();
    return { secret, csrf, cookie: `__Host-aisoc-review=${secret}` };
  }
  async function rpc(accessToken: string, method: string, params: unknown = {}) {
    return sendAdmin('/mcp', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  }
  return { mf, db, sendAuth, sendAdmin, registerClient, startAuthorization, authorizationCode, getToken, session, rpc };
}
