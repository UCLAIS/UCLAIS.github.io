import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import type { PublicationAttempt } from '../src/storage';

describe('actual D1 publication receipt integrity', () => {
  let mf: Miniflare;
  beforeAll(async () => {
    const bundle = await build({
      stdin: { contents: `import {D1PrivateStore} from './src/admin-store'; import {errorResponse} from './src/browser';
        export default {async fetch(request,env) {try {
          const store=new D1PrivateStore(env.PRIVATE_DB); const url=new URL(request.url);
          if(request.method==='POST') {await store.putAttempt(await request.json()); return Response.json({ok:true});}
          if(url.pathname==='/pending') return Response.json(await store.listPendingAttempts());
          return Response.json(await store.getAttempt(url.searchParams.get('id')));
        }catch(error){return errorResponse(error);}}};`, resolveDir: process.cwd() },
      bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    });
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-29', d1Databases: { PRIVATE_DB: 'private' } }));
    const db = await mf.getD1Database('PRIVATE_DB');
    await db.prepare('CREATE TABLE publication_attempts(id TEXT PRIMARY KEY,payload TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
  }, 60_000);
  afterAll(async () => { await mf?.dispose(); });
  const attempt = (id: string): PublicationAttempt => ({ id, actorId: '57414242', candidateId: 'candidate-original', candidateHash: 'a'.repeat(64), releaseId: 'b'.repeat(64), previousReleaseId: null, state: 'committed', cleanupComplete: false, createdAt: '2026-10-29T12:00:00.000Z' });
  const put = (value: PublicationAttempt) => mf.dispatchFetch('https://store.example/attempt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value), redirect: 'manual' });
  const get = async (id: string) => await (await mf.dispatchFetch(`https://store.example/attempt?id=${id}`)).json() as PublicationAttempt;

  it.each([false, undefined])('promotes committed cleanupComplete=%s to true', async cleanupComplete => {
    const original = { ...attempt(`cleanup-${String(cleanupComplete)}`), cleanupComplete };
    expect((await put(original)).status).toBe(200);
    expect((await put({ ...original, cleanupComplete: true })).status).toBe(200);
    expect(await get(original.id)).toMatchObject({ state: 'committed', cleanupComplete: true });
    const pending = await (await mf.dispatchFetch('https://store.example/pending')).json() as PublicationAttempt[];
    expect(pending.some(value => value.id === original.id)).toBe(false);
  });

  it.each(['pending', 'conflict'] as const)('does not regress a committed receipt to %s or lose completed cleanup', async state => {
    const original = { ...attempt(`regression-${state}`), cleanupComplete: true };
    await put(original);
    expect((await put({ ...original, state, cleanupComplete: false })).status).toBe(200);
    expect(await get(original.id)).toEqual(original);
  });

  it.each([false, undefined])('does not let a stale committed cleanupComplete=%s write undo finished cleanup', async cleanupComplete => {
    const original = { ...attempt(`terminal-cleanup-${String(cleanupComplete)}`), cleanupComplete: true, completedAt: '2026-10-29T12:01:00.000Z' };
    await put(original);
    expect((await put({ ...original, cleanupComplete, completedAt: undefined })).status).toBe(200);
    expect(await get(original.id)).toEqual(original);
    const pending = await (await mf.dispatchFetch('https://store.example/pending')).json() as PublicationAttempt[];
    expect(pending.some(value => value.id === original.id)).toBe(false);
  });

  it.each([
    { actorId: '999' }, { candidateId: 'candidate-other' }, { candidateHash: 'c'.repeat(64) }, { releaseId: 'd'.repeat(64) },
  ])('rejects operation-identity substitution %j without changing the receipt', async replacement => {
    const original = attempt(`identity-${Object.keys(replacement)[0]}`);
    await put(original);
    const response = await put({ ...original, ...replacement, cleanupComplete: true });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'operation_mismatch' });
    expect(await get(original.id)).toEqual(original);
  });

  it('includes old pending attempts beyond the recent-history limit', async () => {
    const db = await mf.getD1Database('PRIVATE_DB');
    const old = { ...attempt('old-pending'), state: 'pending' as const };
    await put(old);
    await db.prepare('UPDATE publication_attempts SET updated_at=? WHERE id=?').bind('2000-01-01T00:00:00.000Z', old.id).run();
    for (let index = 0; index < 110; index++) await put({ ...attempt(`recent-${index}`), cleanupComplete: true });
    const pending = await (await mf.dispatchFetch('https://store.example/pending')).json() as PublicationAttempt[];
    expect(pending.some(value => value.id === old.id)).toBe(true);
  });
});
