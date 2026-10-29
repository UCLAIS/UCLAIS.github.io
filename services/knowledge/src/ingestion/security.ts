import { createHash } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
export { MAX_SOURCE_BYTES, MAX_PDF_BYTES, MAX_TEXT_BYTES } from './limits.js';
import { MAX_SOURCE_BYTES } from './limits.js';

export const TEACHING_REPOSITORIES = [
  { name: 'Machine-Learning-Tutorials', branch: 'master', year: '2020/21' },
  { name: 'ML-Tutorials-Season-2', branch: 'main', year: '2021/22' },
  { name: 'ml-tutorials-season-3', branch: 'main', year: '2022/23' },
  { name: 'ml-tutorials-season-4', branch: 'main', year: '2023/24' },
  { name: 'ml-tutorials-season-5', branch: 'main', year: '2024/25' },
] as const;

const approvedRepositories = new Set<string>(TEACHING_REPOSITORIES.map(repo => repo.name));

export function sourceId(url: string): string {
  return `source:${createHash('sha256').update(url).digest('hex').slice(0, 24)}`;
}

export function validateRepositoryPath(value: string): string {
  if (!value || value.includes('\\') || /[\x00-\x1f\x7f]/.test(value) || value.startsWith('/') || value.includes('%')) {
    throw new Error('Unsafe repository path');
  }
  const parts = value.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part === '.git')) {
    throw new Error('Unsafe repository path');
  }
  return value;
}

// Only these publisher-selected endpoints can cause outbound requests. Discovered
// URLs are inventory entries, never an instruction to fetch another URL.
export function validateFetchUrl(input: string): URL {
  if (/%(?:2e|2f|5c|00)/i.test(input) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(input) || input.includes('\\')) throw new Error('Unsafe URL path');
  const url = new URL(input);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) {
    throw new Error('Only credential-free approved HTTPS URLs may be fetched');
  }
  const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  if (parts.some(part => part === '.' || part === '..' || part.includes('/') || part.includes('\\') || /[\x00-\x1f\x7f]/.test(part))) {
    throw new Error('Unsafe URL path');
  }
  if (url.hostname === 'agentverse.uclai.co.uk' && url.pathname === '/' && !url.search) return url;
  if (url.hostname === 'api.github.com' && parts[0] === 'repos' && parts[1] === 'UCLAIS' && approvedRepositories.has(parts[2])) {
    if (parts.length === 5 && parts[3] === 'commits' && ['main', 'master'].includes(parts[4]) && !url.search) return url;
    if (parts.length === 6 && parts[3] === 'git' && parts[4] === 'trees' && /^[a-f0-9]{40}$/.test(parts[5]) && url.search === '?recursive=1') return url;
  }
  if (url.hostname === 'raw.githubusercontent.com' && parts[0] === 'UCLAIS' && approvedRepositories.has(parts[1]) && /^[a-f0-9]{40}$/.test(parts[2]) && parts.length > 3 && !url.search) {
    validateRepositoryPath(parts.slice(3).join('/'));
    return url;
  }
  throw new Error('URL is outside the approved source registry');
}

export async function readBoundedResponse(response: Response, maxBytes = MAX_SOURCE_BYTES): Promise<Uint8Array> {
  const advertisedSize = Number(response.headers.get('content-length'));
  if (advertisedSize > maxBytes) {
    await response.body?.cancel();
    throw new Error('Source exceeds the byte limit');
  }
  if (!response.body) throw new Error('Source has no response body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new Error('Source exceeds the byte limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function fetchApproved(input: string, options: { maxBytes?: number; fetcher?: typeof fetch } = {}): Promise<Uint8Array> {
  const url = validateFetchUrl(input);
  const response = await (options.fetcher ?? fetch)(url, {
    redirect: 'manual', signal: AbortSignal.timeout(45_000),
    headers: { 'User-Agent': 'UCLAIS-Knowledge-Importer/1.0', Accept: 'application/vnd.github+json, application/pdf, text/plain, text/html' },
  });
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Error('Source redirect refused');
  }
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Source returned HTTP ${response.status}`); }
  return readBoundedResponse(response, options.maxBytes);
}

export function decodeText(bytes: Uint8Array, maxBytes = MAX_SOURCE_BYTES): string {
  if (bytes.length > maxBytes) throw new Error('Source exceeds the byte limit');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (text.includes('\0')) throw new Error('Binary data is not accepted as text');
  return text;
}

export async function containedPath(root: string, relative: string): Promise<string> {
  validateRepositoryPath(relative);
  const realRoot = await realpath(root);
  const resolved = await realpath(path.join(realRoot, relative));
  if (!resolved.startsWith(realRoot + path.sep)) throw new Error('Source escapes repository root');
  return resolved;
}
