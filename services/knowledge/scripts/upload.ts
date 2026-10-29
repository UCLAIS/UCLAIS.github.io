import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateCorpus } from '../src/core';
import type { Corpus } from '../src/types';
import { parseEndpoint } from './doctor';

const MAX_UPLOAD = 10 * 1024 * 1024;
export interface UploadSummary { draftId: string; revision: number; documentCount: number; conflictCount: number; reviewUrl: string; publication: 'not published' }

export async function uploadCorpus(options: { editorUrl: string; token: string; corpusFile: string }, network: typeof fetch = fetch): Promise<UploadSummary> {
  const endpoint = parseEndpoint(options.editorUrl);
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
  if (!endpoint.pathname.endsWith('/mcp') || !options.token || /[\r\n]/.test(options.token)) throw new Error('Use the editor MCP endpoint and a current editor access token');
  if ((await stat(options.corpusFile)).size > MAX_UPLOAD) throw new Error('Corpus exceeds upload limit');
  const body = await readFile(options.corpusFile, 'utf8');
  if (Buffer.byteLength(body) > MAX_UPLOAD || !validateCorpus(JSON.parse(body) as Corpus).valid) throw new Error('Invalid corpus');
  const response = await network(`${endpoint.href}/imports`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000), headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body });
  if (!response.ok) { await response.body?.cancel(); throw new Error('Import rejected'); }
  if (!response.body) throw new Error('Missing import result');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65536) { await reader.cancel(); throw new Error('Oversized import result'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const result = JSON.parse(new TextDecoder('utf8', { fatal: true }).decode(bytes)) as { draftId?: string; revision?: number; documentCount?: number; conflicts?: unknown[] };
  if (typeof result.draftId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.draftId) || !Number.isSafeInteger(result.revision) || result.revision! < 1 || !Number.isSafeInteger(result.documentCount) || result.documentCount! < 0 || !Array.isArray(result.conflicts)) throw new Error('Invalid import result');
  return { draftId: result.draftId, revision: result.revision!, documentCount: result.documentCount!, conflictCount: result.conflicts.length, reviewUrl: `${endpoint.origin}/review`, publication: 'not published' };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Stage a local corpus as an authenticated private draft. No publication is performed.\n  pnpm exec tsx scripts/upload.ts --editor-url https://EDITOR_HOST/mcp [--corpus data/bootstrap-corpus.json]\nSet KNOWLEDGE_EDITOR_ACCESS_TOKEN in the process environment, never a command argument. KNOWLEDGE_EDITOR_MCP_URL can supply the endpoint.'); return; }
  const value = (flag: string) => { const index = args.indexOf(flag); return index < 0 ? undefined : args[index + 1]; };
  const summary = await uploadCorpus({ editorUrl: value('--editor-url') || process.env.KNOWLEDGE_EDITOR_MCP_URL || '', token: process.env.KNOWLEDGE_EDITOR_ACCESS_TOKEN || '', corpusFile: value('--corpus') || fileURLToPath(new URL('../data/bootstrap-corpus.json', import.meta.url)) });
  console.log(JSON.stringify(summary, null, 2));
  console.log('Prepare this draft through the authenticated editor MCP, then inspect and approve its candidate on the review website.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Corpus upload failed. Check the corpus (maximum 10 MiB), endpoint, network and current editor token/role. No token, source body or remote response was logged.'); process.exitCode = 1; });
}
