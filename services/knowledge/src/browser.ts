import { KnowledgeError } from './types';

export const REVIEW_COOKIE = '__Host-aisoc-review';
export const LOGIN_COOKIE = '__Host-aisoc-login';
export const SESSION_SECONDS = 8 * 60 * 60;

export function randomToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function cookie(request: Request, name: string): string | null {
  const matches = (request.headers.get('Cookie') || '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0].slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : null;
}

export function setCookie(name: string, value: string, seconds: number): string {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${seconds}`;
}

export function secureHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return headers;
}

export function page(title: string, body: string, extra?: HeadersInit): Response {
  const headers = secureHeaders(extra);
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:16px/1.55 system-ui;max-width:940px;margin:48px auto;padding:0 24px;color:#191919}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f4;padding:16px}button,input,select{font:inherit;padding:8px;margin:4px}section{border-top:1px solid #bbb;margin-top:24px;padding-top:16px}.notice{background:#fff4d6;padding:12px}a{color:#174ac0}</style><h1>${escapeHtml(title)}</h1>${body}</html>`, { headers });
}

export function redirect(location: string, extra?: HeadersInit): Response {
  const headers = secureHeaders(extra);
  headers.set('Location', location);
  return new Response(null, { status: 302, headers });
}

export function assertHttpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) throw new Error('Configure an exact HTTPS origin');
  return value;
}

export function assertBrowserPost(request: Request, origin: string): void {
  if (request.method !== 'POST') throw new KnowledgeError('method_not_allowed', 'POST required', 405);
  if (request.headers.has('Authorization')) throw new KnowledgeError('browser_session_required', 'Use the authenticated review page', 403);
  if (request.headers.get('Origin') !== origin) throw new KnowledgeError('invalid_origin', 'Invalid request origin', 403);
  const contentType = request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/x-www-form-urlencoded') throw new KnowledgeError('invalid_content_type', 'Form submission required', 415);
}

export function assertMcpOrigin(request: Request, allowed: string[]): void {
  const origin = request.headers.get('Origin');
  if (origin !== null && !allowed.includes(origin)) throw new KnowledgeError('invalid_origin', 'Invalid request origin', 403);
}

export async function limitedForm(request: Request): Promise<URLSearchParams> {
  const body = await limitedText(request, 16_384);
  return new URLSearchParams(body);
}

export async function limitedText(request: Request, limit: number): Promise<string> {
  if (Number(request.headers.get('Content-Length')) > limit) throw new KnowledgeError('body_too_large', 'Request too large', 413);
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new KnowledgeError('body_too_large', 'Request too large', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function errorResponse(error: unknown): Response {
  const known = error instanceof KnowledgeError;
  return Response.json({ error: known ? error.code : 'service_error', message: known ? error.message : 'Request could not be completed' }, { status: known ? error.status : 503, headers: secureHeaders() });
}
