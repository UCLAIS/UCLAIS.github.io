import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { approvedCorpus, makeIndex } from '../src/core';
import { createPublicHandler } from '../src/public-worker';
import { MemoryPublishedStore, sha256 } from '../src/storage';
import type { Corpus, Release } from '../src/types';
import { LumaCalendar } from '../src/luma';

/** Loopback-only read adapter. This module is never imported by a deployed Worker. */
export async function startPublicDev(options: { port?: number; corpusFile?: string } = {}): Promise<Server> {
  const port = options.port ?? 8787;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Choose a port from 0 to 65535.');
  const corpusFile = options.corpusFile ?? fileURLToPath(new URL('../data/bootstrap-corpus.json', import.meta.url));
  const corpus = approvedCorpus(JSON.parse(await readFile(corpusFile, 'utf8')) as Corpus);
  const store = new MemoryPublishedStore();
  const release: Release = { id: crypto.randomUUID(), hash: await sha256(JSON.stringify(corpus)), createdAt: new Date().toISOString(), previousReleaseId: null, corpus, index: makeIndex(corpus).toJSON(), operationId: crypto.randomUUID() };
  await store.putRelease(release);
  await store.compareAndSwapActive({ releaseId: release.id, hash: release.hash, operationId: release.operationId, previousReleaseId: null }, null);
  const handler = createPublicHandler(store, new LumaCalendar());
  const server = createServer(async (incoming, outgoing) => {
    const host = incoming.headers.host;
    const address = server.address();
    const actualPort = address && typeof address !== 'string' ? address.port : port;
    if (![ `127.0.0.1:${actualPort}`, `localhost:${actualPort}` ].includes(host || '') || !incoming.url?.startsWith('/') || incoming.url.startsWith('//')) {
      outgoing.writeHead(403, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }); outgoing.end('Invalid local host.'); return;
    }
    try {
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of incoming) {
        const bytes = Buffer.from(chunk); size += bytes.byteLength;
        if (size > 1024 * 1024) { outgoing.writeHead(413, { 'Cache-Control': 'no-store' }); outgoing.end('Request too large.'); return; }
        chunks.push(bytes);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const method = incoming.method || 'GET';
      const request = new Request(`http://${host}${incoming.url}`, { method, headers, ...(!['GET', 'HEAD'].includes(method) && size ? { body: Buffer.concat(chunks) } : {}) });
      const response = await handler(request, { ALLOWED_ORIGINS: `http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:${actualPort},http://localhost:${actualPort}` });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const reader = response.body.getReader();
        while (true) { const { value, done } = await reader.read(); if (done) break; outgoing.write(Buffer.from(value)); }
      }
      outgoing.end();
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      outgoing.end('{"error":"local_service_error"}');
    }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  return server;
}
