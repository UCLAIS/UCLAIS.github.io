import { describe, expect, it } from 'vitest';
import { probePermissions, validateProbeConfig, type PermissionProbeConfig } from '../scripts/storage-permissions';

const config: PermissionProbeConfig = { endpoint: 'https://account.r2.cloudflarestorage.com', publishedBucket: 'published-staging', privateBucket: 'private-staging', privateSentinelKey: 'deployment-sentinel.json', accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' };
function responses(statuses: number[]) {
  const calls: Request[] = [];
  const network = (async (input: RequestInfo | URL) => { const request = input as Request; calls.push(request); const status = statuses.shift(); if (!status) throw new Error('Unexpected request'); return new Response(null, { status }); }) as typeof fetch;
  return { network, calls };
}

describe('deployed read-only storage probe', () => {
  it('requires working reads and explicit write/delete/private denials', async () => {
    const { network, calls } = responses([200, 403, 403, 403]);
    const report = await probePermissions(config, network);
    expect(report.ok).toBe(true);
    expect(calls.map(call => call.method)).toEqual(['GET', 'PUT', 'DELETE', 'HEAD']);
    expect(new URL(calls[1].url).pathname).toMatch(/^\/published-staging\/permission-probe\/[a-f0-9-]+\.json$/);
    expect(calls[1].url).toBe(calls[2].url);
    expect(new URL(calls[3].url).pathname).toBe('/private-staging/deployment-sentinel.json');
    expect(JSON.stringify(report)).not.toContain(config.secretAccessKey);
    expect(JSON.stringify(report)).not.toContain(config.accessKeyId);
  });

  it('cleans up an unexpectedly writable disposable object and still fails', async () => {
    const { network, calls } = responses([200, 200, 204, 403]);
    const report = await probePermissions(config, network);
    expect(report.ok).toBe(false);
    expect(report.cleanupNeeded).toBe(false);
    expect(calls[2].method).toBe('DELETE');
    expect(calls[1].url).toBe(calls[2].url);
  });

  it('reports a writable probe object requiring operator cleanup', async () => {
    const { network } = responses([200, 200, 403, 403]);
    const report = await probePermissions(config, network);
    expect(report.ok).toBe(false);
    expect(report.cleanupNeeded).toBe(true);
  });

  it('does not treat an invalid credential as evidence of isolation', async () => {
    const { network, calls } = responses([403]);
    expect((await probePermissions(config, network)).ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('fails when a private object is readable or its existence cannot be established', async () => {
    for (const status of [200, 404]) {
      const { network } = responses([200, 403, 403, status]);
      expect((await probePermissions(config, network)).ok).toBe(false);
    }
  });

  it('rejects shared buckets, untrusted endpoints and traversal keys', () => {
    expect(() => validateProbeConfig({ ...config, privateBucket: config.publishedBucket })).toThrow();
    expect(() => validateProbeConfig({ ...config, endpoint: 'https://elsewhere.example' })).toThrow();
    expect(() => validateProbeConfig({ ...config, privateSentinelKey: '../active.json' })).toThrow();
  });
});
