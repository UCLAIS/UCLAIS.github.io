import { KnowledgeError } from '../types';

export interface ManagementEnv {
  MANAGEMENT_ORIGIN: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ALLOWED_GITHUB_IDS?: string;
  ASSETS: Fetcher;
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
export interface Session { token: string; csrf: string; expires: number }
const encoder = new TextEncoder();
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unbase64 = (input: string) => Uint8Array.from(atob(input.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
export const random = () => base64(crypto.getRandomValues(new Uint8Array(32)));

export function origin(env: ManagementEnv): string {
  const url = new URL(env.MANAGEMENT_ORIGIN);
  if (url.protocol !== 'https:' || url.origin !== env.MANAGEMENT_ORIGIN || !env.SESSION_SECRET || env.SESSION_SECRET.length < 43 || !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) throw new KnowledgeError('configuration', 'Management sign-in has not been configured.', 503);
  return url.origin;
}

/** Plaintext tokens never reach JavaScript. Separate purposes prevent encrypted-cookie substitution. */
export async function seal(env: ManagementEnv, purpose: string, value: object): Promise<string> {
  const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(env.SESSION_SECRET)), 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(purpose) }, key, encoder.encode(JSON.stringify(value))));
  return base64(new Uint8Array([...iv, ...ciphertext]));
}

export async function unseal<T extends { expires: number }>(env: ManagementEnv, purpose: string, input: string): Promise<T | null> {
  try {
    if (!/^[A-Za-z0-9_-]{40,3500}$/.test(input)) return null;
    const bytes = unbase64(input);
    const key = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', encoder.encode(env.SESSION_SECRET)), 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: encoder.encode(purpose) }, key, bytes.slice(12));
    const value = JSON.parse(new TextDecoder().decode(plaintext));
    return typeof value.expires === 'number' && value.expires > Date.now() ? value : null;
  } catch { return null; }
}

export function readCookie(request: Request, name: string): string {
  const values = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
export function sessionCookie(name: string, value: string, seconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
}
export const SESSION_COOKIE = '__Host-committee-session';
export const LOGIN_COOKIE = '__Host-committee-login';
export async function challenge(verifier: string): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
}

export function assertWrite(request: Request, env: ManagementEnv, session: Session): void {
  if (request.headers.get('Origin') !== origin(env) || request.headers.get('X-CSRF-Token') !== session.csrf || request.headers.has('Authorization')) throw new KnowledgeError('forbidden', 'Refresh this page and submit the change again.', 403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') throw new KnowledgeError('invalid_content_type', 'JSON required.', 415);
}
