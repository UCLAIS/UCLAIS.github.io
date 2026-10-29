import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile } from 'node:fs/promises';

describe('privacy-safe operations counters in actual D1', () => {
  let mf: Miniflare;
  beforeAll(async () => {
    const bundle = await build({ stdin: { contents: `import {recordMetric,readMetrics,pruneMetrics} from './src/metrics';
      export default {async fetch(request,env) {try {
        const url=new URL(request.url);
        if(url.pathname==='/record') {const value=await request.json(); await recordMetric(env.DB,value.service,value.outcome);return Response.json({ok:true});}
        if(url.pathname==='/prune') {await pruneMetrics(env.DB);return Response.json({ok:true});}
        return Response.json(await readMetrics(env.DB));
      }catch {return Response.json({error:'metrics_failure'},{status:400});}}};`, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent' });
    mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-10-29', d1Databases: { DB: 'metrics' } }));
    const db = await mf.getD1Database('DB');
    await db.prepare(await readFile('migrations/0002_operations.sql', 'utf8')).run();
  }, 60_000);
  afterAll(async () => { await mf?.dispose(); });
  const record = (service: string, outcome: string, extra: Record<string, unknown> = {}) => mf.dispatchFetch('https://metrics.example/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service, outcome, ...extra }) });

  it('atomically aggregates concurrent increments into one fixed hourly row', async () => {
    const responses = await Promise.all(Array.from({ length: 25 }, () => record('auth', 'auth_failure')));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const rows = await (await mf.dispatchFetch('https://metrics.example/')).json() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ service: 'auth', outcome: 'auth_failure', count: 25 });
    expect(new Date(rows[0].hour).getUTCMinutes()).toBe(0);
    expect(new Date(rows[0].hour).getUTCSeconds()).toBe(0);
  });

  it('stores no tokens, IPs, queries, URLs, draft content or extra dimensions', async () => {
    const secret = 'sentinel-private-token-query-draft-content';
    expect((await record('admin', 'request_success', { token: secret, ip: '192.0.2.10', query: secret, path: `/private/${secret}`, draft: secret })).status).toBe(200);
    const db = await mf.getD1Database('DB');
    const columns = await db.prepare('PRAGMA table_info(operation_metrics)').all<{ name: string }>();
    expect(columns.results.map(column => column.name)).toEqual(['hour', 'service', 'outcome', 'count']);
    const rows = await db.prepare('SELECT * FROM operation_metrics').all();
    expect(JSON.stringify(rows.results)).not.toContain(secret);
    expect(JSON.stringify(rows.results)).not.toContain('192.0.2.10');
  });

  it.each([['private-user-57414242', 'auth_failure'], ['auth', 'query-membership'], ['admin', '__proto__']])('rejects unbounded dimensions %s/%s', async (service, outcome) => {
    expect((await record(service, outcome)).status).toBe(400);
    const db = await mf.getD1Database('DB');
    expect(await db.prepare('SELECT COUNT(*) AS count FROM operation_metrics WHERE service=? AND outcome=?').bind(service, outcome).first()).toEqual({ count: 0 });
  });

  it('reads only the latest 168 hourly buckets and prunes older data', async () => {
    const db = await mf.getD1Database('DB');
    const now = Math.floor(Date.now() / 3_600_000) * 3600;
    const first = now - 167 * 3600;
    await db.prepare('INSERT INTO operation_metrics(hour,service,outcome,count) VALUES(?,?,?,?)').bind(first, 'admin', 'publication_success', 2).run();
    await db.prepare('INSERT INTO operation_metrics(hour,service,outcome,count) VALUES(?,?,?,?)').bind(first - 3600, 'admin', 'publication_failure', 7).run();
    const rows = await (await mf.dispatchFetch('https://metrics.example/')).json() as any[];
    expect(rows.some(row => row.outcome === 'publication_success' && row.count === 2)).toBe(true);
    expect(rows.some(row => row.outcome === 'publication_failure')).toBe(false);
    expect((await mf.dispatchFetch('https://metrics.example/prune')).status).toBe(200);
    expect(await db.prepare('SELECT * FROM operation_metrics WHERE hour<?').bind(first).first()).toBeNull();
    expect(await db.prepare('SELECT count FROM operation_metrics WHERE hour=?').bind(first).first()).toEqual({ count: 2 });
  });
});
