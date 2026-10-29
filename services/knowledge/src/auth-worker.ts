import { WorkerEntrypoint } from 'cloudflare:workers';
import { OAuthAuthorizationServer, AuthorizationError, type AuthRequest, type ValidatedAccessToken } from '@cloudflare/workers-oauth-provider';
import { D1PrivateStore } from './admin-store';
import { KnowledgeError, type Actor } from './types';
import { recordMetric } from './metrics';
import { assertBrowserPost, assertHttpsOrigin, cookie, errorResponse, escapeHtml, limitedForm, limitedText, LOGIN_COOKIE, page, randomToken, redirect, secureHeaders, setCookie, sha256 } from './browser';

export interface AuthProps { githubId: string }
export interface AuthEnv {
  OAUTH_KV: KVNamespace;
  PRIVATE_DB: D1Database;
  AUTH_ORIGIN: string;
  ADMIN_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}
type BrowserLogin = { challenge: string; verifier: string };
type UpstreamData = { verifier: string };
const EDIT_SCOPE = 'knowledge:edit';

export function makeAuthorizationServer(env: AuthEnv) {
  const issuer = assertHttpsOrigin(env.AUTH_ORIGIN);
  const admin = assertHttpsOrigin(env.ADMIN_ORIGIN);
  return new OAuthAuthorizationServer<AuthEnv>({
    issuer, resources: [`${admin}/mcp`], scopesSupported: [EDIT_SCOPE, 'offline_access'],
    clientIdMetadataDocumentEnabled: true, clientRegistrationEndpoint: '/oauth/register',
    accessTokenTTL: 900, refreshTokenTTL: 7 * 24 * 60 * 60,
    allowTokenExchangeGrant: false,
    tokenExchangeCallback: async options => {
      const actor = await new D1PrivateStore(options.env.PRIVATE_DB).actor(options.userId);
      if (!actor) throw new Error('Maintainer permission revoked');
      return { newProps: { githubId: actor.githubId }, accessTokenScope: options.requestedScope.filter(scope => scope === EDIT_SCOPE || scope === 'offline_access') };
    },
  });
}

async function pkce(verifier: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function githubRedirect(env: AuthEnv, state: string, verifier: string, headers?: HeadersInit): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new KnowledgeError('configuration', 'GitHub sign-in has not been configured', 503);
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', `${env.AUTH_ORIGIN}/github/callback`);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await pkce(verifier));
  url.searchParams.set('code_challenge_method', 'S256');
  // Empty upstream scopes: public GitHub account ID is sufficient; no repository or email access.
  return redirect(url.toString(), headers);
}

export async function githubIdentity(env: AuthEnv, code: string, verifier: string, network: typeof fetch = fetch): Promise<string> {
  if (!code || code.length > 1024 || !/^[a-f0-9]{64}$/.test(verifier)) throw new KnowledgeError('invalid_login', 'Invalid GitHub login', 403);
  const tokenResponse = await network('https://github.com/login/oauth/access_token', {
    method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code, code_verifier: verifier, redirect_uri: `${env.AUTH_ORIGIN}/github/callback` }),
  });
  if (!tokenResponse.ok) throw new KnowledgeError('login_unavailable', 'GitHub sign-in is unavailable', 503);
  const token = await tokenResponse.json() as { access_token?: string; token_type?: string; error?: string };
  if (token.error || !token.access_token || token.token_type?.toLowerCase() !== 'bearer') throw new KnowledgeError('invalid_login', 'GitHub login was rejected', 403);
  const response = await network('https://api.github.com/user', {
    redirect: 'manual', signal: AbortSignal.timeout(15_000),
    headers: { 'Authorization': `Bearer ${token.access_token}`, 'Accept': 'application/vnd.github+json', 'User-Agent': 'UCL-AI-Society-Knowledge', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new KnowledgeError('invalid_login', 'GitHub identity could not be verified', 403);
  const profile = await response.json() as { id?: number; type?: string };
  if (!Number.isSafeInteger(profile.id) || profile.id! <= 0 || profile.type !== 'User') throw new KnowledgeError('invalid_login', 'A personal GitHub account is required', 403);
  // The upstream access token is intentionally discarded after reading the verified numeric ID.
  return String(profile.id);
}

async function completeMcpLogin(request: Request, env: AuthEnv, provider: ReturnType<typeof makeAuthorizationServer>): Promise<Response> {
  const oauth = provider.getOAuthApi(env);
  const resumed = await oauth.finishUpstream<UpstreamData>(request);
  const url = new URL(request.url);
  if (url.searchParams.has('error')) throw new KnowledgeError('login_denied', 'GitHub sign-in was declined', 403);
  const githubId = await githubIdentity(env, url.searchParams.get('code') || '', resumed.data.verifier);
  const actor = await new D1PrivateStore(env.PRIVATE_DB).actor(githubId);
  if (!actor) throw new KnowledgeError('not_a_maintainer', 'This GitHub account is not an approved maintainer', 403);
  const result = await oauth.completeAuthorization({ request: resumed.request, userId: githubId, metadata: { service: 'society-knowledge' }, scope: resumed.request.scope.filter(scope => scope === EDIT_SCOPE || scope === 'offline_access'), props: { githubId } });
  return redirect(result.redirectTo, resumed.headers);
}

export async function handleAuthRequest(request: Request, env: AuthEnv, ctx: ExecutionContext): Promise<Response> {
  try {
    const origin = assertHttpsOrigin(env.AUTH_ORIGIN);
    const admin = assertHttpsOrigin(env.ADMIN_ORIGIN);
    const url = new URL(request.url);
    if (url.origin !== origin) throw new KnowledgeError('invalid_host', 'Invalid host', 403);
    const provider = makeAuthorizationServer(env);
    const oauth = provider.getOAuthApi(env);
    const store = new D1PrivateStore(env.PRIVATE_DB);
    await store.rateLimit(`auth-ip:${request.headers.get('CF-Connecting-IP') || 'unknown'}`, 120);
    if (request.method === 'POST') request = new Request(request, { body: await limitedText(request, 65_536) });
    if (url.pathname === '/authorize' && request.method === 'GET') {
      const authRequest: AuthRequest = await oauth.parseAuthRequest(request);
      if (!authRequest.codeChallenge || authRequest.codeChallengeMethod !== 'S256') throw new KnowledgeError('pkce_required', 'S256 PKCE is required', 400);
      const description = await oauth.describeConsent(authRequest);
      const transaction = await oauth.beginConsent(authRequest);
      return page('Connect your assistant to Society Knowledge', `<p>This connection can read and edit shared drafts. Publishing requires the separate review page.</p><p>Client: <strong>${escapeHtml(description.clientName)}</strong>${description.clientDomain ? ` (${escapeHtml(description.clientDomain)})` : ' (client name is unverified)'}</p><p>Callback host: <strong>${escapeHtml(description.redirectHost)}</strong></p><p>Requested permissions: ${escapeHtml(description.scope.join(', '))}</p>${description.redirectIsLoopback ? '<p class="notice">This callback goes to a local application. Check which app is listening.</p>' : ''}<form method="post" action="/consent"><input type="hidden" name="handle" value="${escapeHtml(transaction.handle)}"><button name="decision" value="allow">Continue with GitHub</button><button name="decision" value="deny">Decline</button></form>`, transaction.headers);
    }
    if (url.pathname === '/consent') {
      assertBrowserPost(request, origin);
      const form = await limitedForm(request);
      const handle = form.get('handle') || '';
      if (form.get('decision') !== 'allow') {
        const denied = await oauth.denyConsent(request, handle);
        return redirect(denied.redirectTo, denied.headers);
      }
      const approved = await oauth.approveConsent(request, handle);
      const verifier = randomToken();
      const upstream = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
      return await githubRedirect(env, upstream.state, verifier, upstream.headers);
    }
    if (url.pathname === '/browser/login' && request.method === 'GET') {
      const challenge = url.searchParams.get('challenge') || '';
      if (!/^[a-f0-9]{64}$/.test(challenge)) throw new KnowledgeError('invalid_login', 'Start sign-in from the review page', 400);
      const state = randomToken();
      const verifier = randomToken();
      await store.putTransaction(state, 'github-browser', { challenge, verifier } satisfies BrowserLogin, 600);
      return await githubRedirect(env, `browser_${state}`, verifier, { 'Set-Cookie': setCookie(LOGIN_COOKIE, state, 600) });
    }
    if (url.pathname === '/github/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state') || '';
      if (!state.startsWith('browser_')) return await completeMcpLogin(request, env, provider);
      const token = state.slice(8);
      if (cookie(request, LOGIN_COOKIE) !== token) throw new KnowledgeError('invalid_state', 'Login browser binding failed', 403);
      const transaction = await store.consumeTransaction<BrowserLogin>(token, 'github-browser');
      if (!transaction) throw new KnowledgeError('invalid_state', 'Login expired or was already used', 403);
      if (url.searchParams.has('error')) throw new KnowledgeError('login_denied', 'GitHub sign-in was declined', 403);
      const githubId = await githubIdentity(env, url.searchParams.get('code') || '', transaction.verifier);
      if (!await store.actor(githubId)) throw new KnowledgeError('not_a_maintainer', 'This GitHub account is not an approved maintainer', 403);
      const ticket = randomToken();
      await store.putTransaction(ticket, 'browser-ticket', { githubId, challenge: transaction.challenge }, 60);
      return redirect(`${admin}/auth/callback?ticket=${ticket}`, { 'Set-Cookie': setCookie(LOGIN_COOKIE, '', 0) });
    }
    return await provider.fetch(request, env, ctx);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      // Only the provider's already-validated redirect is eligible for an OAuth error redirect.
      return error.redirectTo ? redirect(error.redirectTo) : Response.json({ error: error.code }, { status: 400, headers: secureHeaders() });
    }
    return errorResponse(error);
  }
}

export default class AuthWorker extends WorkerEntrypoint<AuthEnv> {
  async fetch(request: Request) {
    const response = await handleAuthRequest(request, this.env, this.ctx);
    this.ctx.waitUntil(recordMetric(this.env.PRIVATE_DB, 'auth', response.status >= 500 ? 'request_error' : response.status >= 400 ? 'auth_failure' : 'request_success').catch(() => {}));
    return response;
  }
  validateToken(resource: string, token: string): Promise<ValidatedAccessToken<AuthProps> | null> {
    return makeAuthorizationServer(this.env).validateToken<AuthProps>(resource, token, this.env);
  }
  async redeemBrowserTicket(ticket: string, verifier: string): Promise<Actor | null> {
    if (!/^[a-f0-9]{64}$/.test(verifier)) return null;
    const store = new D1PrivateStore(this.env.PRIVATE_DB);
    const value = await store.consumeTransaction<{ githubId: string; challenge: string }>(ticket, 'browser-ticket');
    if (!value || value.challenge !== await sha256(verifier)) return null;
    return store.actor(value.githubId);
  }
}
