import { KnowledgeError } from '../types';
import { limitedText, escapeHtml } from '../browser';
import { assertWrite, challenge, LOGIN_COOKIE, ManagementEnv, origin, random, readCookie, seal, Session, SESSION_COOKIE, sessionCookie, unseal } from './auth';
import { Github, knowledgePath, REPO_URL, safeText, slidePath } from './github';
import { toolingStatus } from './status';

const headers = () => new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: headers() });
function redirect(location: string, cookies: string[] = []) {
  const values = headers(); values.set('Location', location); for (const cookie of cookies) values.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers: values });
}
function login(message = 'Sign in with a GitHub account that has write access to the society website repository.', status = 200) {
  const values = headers(); values.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Society Management · UCL AI Society</title><style>body{background:#fdfbf8;color:#261c2e;font:16px/1.6 system-ui;margin:0}main{max-width:540px;margin:14vh auto;padding:32px;border-top:5px solid #2c1748}small{letter-spacing:.14em;text-transform:uppercase;color:#655b6a}h1{font:52px/1.1 Georgia;margin:28px 0}p{color:#655b6a}a{display:inline-block;padding:12px 20px;background:#2c1748;color:#fff;text-decoration:none;margin:20px 0}a:focus-visible{outline:3px solid #9472b8;outline-offset:4px}footer{font-size:13px;border-top:1px solid #d9d0dc;padding-top:24px;margin-top:30px}</style><main><small>UCL AI Society / Committee</small><h1>Society<br>Management.</h1><p>${escapeHtml(message)}</p><a href="/login">Continue with GitHub</a><footer>Knowledge, teaching materials and service status.<br>Uploads submitted to our public GitHub repository are public before a merge.</footer></main></html>`, { status, headers: values });
}

function requiredString(value: unknown, pattern: RegExp, message: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new KnowledgeError('invalid_input', message, 400);
  return value;
}

export async function handleManagement(request: Request, env: ManagementEnv): Promise<Response> {
  try {
    const managementOrigin = origin(env);
    const url = new URL(request.url);
    if (url.origin !== managementOrigin) return response({ error: 'invalid_host' }, 421);
    if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'unknown' })).success) return response({ message: 'Too many requests. Try again shortly.' }, 429);
    if (url.pathname === '/login' && request.method === 'GET') {
      const state = random(); const verifier = random();
      const transaction = await seal(env, 'login', { state, verifier, expires: Date.now() + 10 * 60 * 1000 });
      const target = new URL('https://github.com/login/oauth/authorize');
      target.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: `${managementOrigin}/auth/callback`, state, code_challenge: await challenge(verifier), code_challenge_method: 'S256' }).toString();
      return redirect(target.href, [sessionCookie(LOGIN_COOKIE, transaction, 600)]);
    }
    if (url.pathname === '/auth/callback' && request.method === 'GET') {
      const transaction = await unseal<{ state: string; verifier: string; expires: number }>(env, 'login', readCookie(request, LOGIN_COOKIE));
      if (!transaction || url.searchParams.get('state') !== transaction.state || url.searchParams.has('error')) return login('GitHub sign-in expired or was declined. Start again.', 403);
      const code = requiredString(url.searchParams.get('code'), /^[A-Za-z0-9_\-]{1,200}$/, 'GitHub did not return an authorisation code.');
      let upstream: Response;
      try {
        upstream = await fetch('https://github.com/login/oauth/access_token', { method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000), headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'UCLAI-Committee' }, body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, redirect_uri: `${managementOrigin}/auth/callback`, code, code_verifier: transaction.verifier }).toString() });
      } catch { throw new KnowledgeError('login_network', 'GitHub sign-in is temporarily unavailable. Start again shortly.', 502); }
      if (!upstream.ok) { await upstream.body?.cancel(); throw new KnowledgeError('login_response', 'GitHub could not complete sign-in. Start again shortly.', 502); }
      let token: { access_token?: string; expires_in?: number; error?: string };
      try { token = await upstream.json() as typeof token; }
      catch { throw new KnowledgeError('login_response', 'GitHub returned an unexpected sign-in response. Start again shortly.', 502); }
      if (token.error === 'incorrect_client_credentials' || token.error === 'redirect_uri_mismatch') throw new KnowledgeError('login_configuration', 'GitHub sign-in configuration needs committee attention.', 503);
      if (typeof token.access_token !== 'string' || !token.access_token || token.access_token.length > 1000) throw new KnowledgeError('login_failed', 'GitHub could not complete sign-in. Start again.', 403);
      await new Github(token.access_token).actor(env.ALLOWED_GITHUB_IDS);
      const seconds = Math.min(token.expires_in || 3600, 3600);
      const session = await seal(env, 'session', { token: token.access_token, csrf: random(), expires: Date.now() + seconds * 1000 } satisfies Session);
      return redirect('/', [sessionCookie(SESSION_COOKIE, session, seconds), sessionCookie(LOGIN_COOKIE, '', 0)]);
    }
    const session = await unseal<Session>(env, 'session', readCookie(request, SESSION_COOKIE));
    if (!session) return url.pathname.startsWith('/api/') ? response({ message: 'Sign in to continue.' }, 401) : login();
    const github = new Github(session.token);
    const actor = await github.actor(env.ALLOWED_GITHUB_IDS); // Recheck permissions on every request, including assets.
    if (request.method === 'POST') assertWrite(request, env, session);
    else if (!['GET', 'HEAD'].includes(request.method)) return response({ message: 'Method not allowed.' }, 405);
    if (url.pathname === '/api/session' && request.method === 'GET') return response({ user: actor, csrf: session.csrf, repository: REPO_URL });
    if (url.pathname === '/api/logout' && request.method === 'POST') {
      const values = headers(); values.append('Set-Cookie', sessionCookie(SESSION_COOKIE, '', 0));
      return Response.json({ ok: true }, { headers: values });
    }
    if (url.pathname === '/api/library' && request.method === 'GET') {
      const snapshot = await github.snapshot();
      return response({ commit: snapshot.commit, files: snapshot.entries.filter(entry => entry.type === 'blob' && /^knowledge\/(faqs|guides|tutorials|nexus)\/.+\.md$/.test(entry.path)).map(({ path, sha, size }) => ({ path, sha, size })) });
    }
    if (url.pathname === '/api/document' && request.method === 'GET') {
      const path = knowledgePath(url.searchParams.get('path')); const snapshot = await github.snapshot();
      const entry = snapshot.entries.find(item => item.path === path);
      if (!entry) return response({ message: 'Document not found.' }, 404);
      return response({ path, content: await github.text(entry), commit: snapshot.commit });
    }
    if (url.pathname === '/api/status' && request.method === 'GET') return response(await toolingStatus(github));
    if (url.pathname === '/api/proposals' && request.method === 'GET') {
      const pulls = await github.repo<any[]>('/pulls?state=open&base=main&per_page=100');
      return response({ proposals: pulls.filter(item => item.head?.ref?.startsWith('committee/')).map(item => ({ title: item.title, url: item.html_url, number: item.number, author: item.user.login, updatedAt: item.updated_at })) });
    }
    if (url.pathname === '/api/knowledge' && request.method === 'POST') {
      const input = JSON.parse(await limitedText(request, 600 * 1024));
      const path = knowledgePath(input.path); const content = safeText(input.content);
      const base = requiredString(input.commit, /^[a-f0-9]{40}$/, 'Reload the library before submitting.');
      const title = `Update knowledge: ${path.slice('knowledge/'.length)}`;
      return response(await github.proposal(base, [{ path, content }], title, actor.login), 201);
    }
    if (url.pathname === '/api/slides' && request.method === 'POST') {
      const input = JSON.parse(await limitedText(request, 12 * 1024 * 1024));
      const path = knowledgePath(input.path); const pdfPath = slidePath(path);
      const base = requiredString(input.commit, /^[a-f0-9]{40}$/, 'Reload the library before submitting.');
      const data = requiredString(input.pdf, /^[A-Za-z0-9+/]+={0,2}$/, 'Upload a PDF exported from your slide deck.');
      if (data.length > Math.ceil(8 * 1024 * 1024 / 3) * 4 || data.length % 4 || !atob(data.slice(0, 12)).startsWith('%PDF-')) throw new KnowledgeError('invalid_pdf', 'Use a PDF no larger than 8 MiB.', 400);
      const snapshot = await github.snapshot();
      if (snapshot.commit !== base) throw new KnowledgeError('stale_base', 'The repository changed. Reload before submitting.', 409);
      const sourceExists = snapshot.entries.some(entry => entry.path === path);
      if (sourceExists !== (input.replace === true)) throw new KnowledgeError('existing_source', sourceExists ? 'This path already exists. Choose it in the replacement list or use a new path.' : 'The session no longer exists. Reload the library.', 409);
      const metadataPath = path.replace(/\.md$/, '.meta.json');
      const existingMeta = snapshot.entries.find(entry => entry.path === metadataPath);
      const metadata = existingMeta ? JSON.parse(await github.text(existingMeta)) : {};
      if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) throw new KnowledgeError('invalid_metadata', 'The existing metadata needs correction in GitHub.', 400);
      const changes: { path: string; content: string; encoding?: 'utf-8' | 'base64' }[] = [{ path: pdfPath, content: data, encoding: 'base64' }];
      if (!sourceExists) {
        const title = safeText(input.title, 200).replace(/[\r\n]/g, ' ');
        const year = typeof input.year === 'string' && /^\d{4}\/\d{2}$/.test(input.year) ? input.year : undefined;
        const series = typeof input.series === 'string' && input.series.trim() ? safeText(input.series, 200) : undefined;
        const order = input.order === undefined || input.order === '' ? undefined : Number(input.order);
        if (order !== undefined && (!series || !Number.isInteger(order) || order < 1 || order > 10000)) throw new KnowledgeError('invalid_metadata', 'A session number needs a series and must be between 1 and 10,000.', 400);
        Object.assign(metadata, { title, type: path.startsWith('knowledge/nexus/') ? 'nexus-session' : 'tutorial', archived: true, status: 'published', ...(year ? { year } : {}), ...(series ? { series } : {}), ...(order ? { order } : {}) });
        changes.push({ path, content: `# ${title}\n\n## Additional information\n\n${typeof input.notes === 'string' && input.notes.trim() ? safeText(input.notes, 20000) : 'Slides and source text are provided in the attached deck.'}\n` });
      }
      metadata.slides = pdfPath;
      const content = safeText(JSON.stringify(metadata, null, 2) + '\n', 65536);
      changes.push({ path: metadataPath, content });
      return response(await github.proposal(base, changes, `Update slides: ${path.slice('knowledge/'.length)}`, actor.login), 201);
    }
    if (url.pathname.startsWith('/api/')) return response({ message: 'Not found.' }, 404);
    if (!['/', '/index.html', '/app.js', '/style.css'].includes(url.pathname)) return response({ message: 'Not found.' }, 404);
    const asset = await env.ASSETS.fetch(request);
    const values = headers(); asset.headers.forEach((value, name) => { if (['content-type', 'content-length'].includes(name)) values.set(name, value); });
    return new Response(asset.body, { status: asset.status, headers: values });
  } catch (error) {
    return response({ message: error instanceof KnowledgeError ? error.message : 'The request could not be completed. Refresh before retrying.', error: error instanceof KnowledgeError ? error.code : 'service_error' }, error instanceof KnowledgeError ? error.status : 503);
  }
}
export default { fetch: handleManagement };
