import { AwsClient } from 'aws4fetch';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface PermissionProbeConfig {
  endpoint: string; publishedBucket: string; privateBucket: string; privateSentinelKey: string;
  accessKeyId: string; secretAccessKey: string;
}
export interface PermissionProbeReport { ok: boolean; checks: { name: string; passed: boolean; status?: number }[]; cleanupNeeded: boolean }

export function validateProbeConfig(config: PermissionProbeConfig): void {
  const endpoint = new URL(config.endpoint);
  const bucket = /^[a-z0-9][a-z0-9-]{1,62}$/;
  if (endpoint.protocol !== 'https:' || !/^[a-z0-9-]+(?:\.(?:eu|fedramp|us))?\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/') throw new Error('Invalid R2 endpoint');
  if (!bucket.test(config.publishedBucket) || !bucket.test(config.privateBucket) || config.publishedBucket === config.privateBucket) throw new Error('Use separate published and private buckets');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,240}$/.test(config.privateSentinelKey) || config.privateSentinelKey.split('/').some(segment => segment === '..' || segment === '.')) throw new Error('Provide an existing non-sensitive private sentinel key');
  if (!config.accessKeyId || !config.secretAccessKey) throw new Error('Read-only R2 credentials required');
}

/** Explicit deployment check: expected-denied writes use only a fresh, disposable key. */
export async function probePermissions(config: PermissionProbeConfig, network?: typeof fetch): Promise<PermissionProbeReport> {
  validateProbeConfig(config);
  const signer = new AwsClient({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, service: 's3', region: 'auto' });
  const report: PermissionProbeReport = { ok: false, checks: [], cleanupNeeded: false };
  const objectUrl = (bucket: string, key: string) => new URL(`/${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`, config.endpoint);
  const send = async (bucket: string, key: string, method: string, body?: string) => {
    const url = objectUrl(bucket, key);
    const init = { method, ...(body === undefined ? {} : { body }), redirect: 'error' as const, signal: AbortSignal.timeout(15000) };
    const response = network ? await network(await signer.sign(url, init)) : await signer.fetch(url, init);
    await response.body?.cancel();
    return response.status;
  };
  const activeStatus = await send(config.publishedBucket, 'active.json', 'GET');
  report.checks.push({ name: 'Read published active pointer', passed: activeStatus === 200, status: activeStatus });
  // A valid working read credential is essential; denial with an invalid credential proves nothing.
  if (activeStatus !== 200) return report;
  const key = `permission-probe/${crypto.randomUUID()}.json`;
  const putStatus = await send(config.publishedBucket, key, 'PUT', '{"deploymentPermissionProbe":true}');
  report.checks.push({ name: 'Published object creation denied', passed: putStatus === 403, status: putStatus });
  if (putStatus >= 200 && putStatus < 300) {
    // A mis-scoped credential wrote the disposable probe; clean it without touching real releases.
    report.cleanupNeeded = true;
    const cleanupStatus = await send(config.publishedBucket, key, 'DELETE');
    report.cleanupNeeded = !(cleanupStatus >= 200 && cleanupStatus < 300);
    report.checks.push({ name: 'Unsafe credential probe cleanup', passed: !report.cleanupNeeded, status: cleanupStatus });
  } else {
    const deleteStatus = await send(config.publishedBucket, key, 'DELETE');
    report.checks.push({ name: 'Published object deletion denied', passed: deleteStatus === 403, status: deleteStatus });
  }
  const privateStatus = await send(config.privateBucket, config.privateSentinelKey, 'HEAD');
  report.checks.push({ name: 'Existing private sentinel inaccessible', passed: privateStatus === 403, status: privateStatus });
  report.ok = report.checks.every(check => check.passed) && !report.cleanupNeeded;
  return report;
}

async function main() {
  if (!process.argv.includes('--confirm-denial-probe')) {
    console.log('Requires --confirm-denial-probe. This deployment check attempts a PUT and DELETE on a fresh disposable published-bucket key and expects 403. If a mis-scoped credential permits PUT, it attempts cleanup and fails the check. It also reads active.json and HEADs a known existing, non-sensitive private sentinel.\nRequired env: PUBLISHED_S3_ENDPOINT, PUBLISHED_BUCKET_NAME, PUBLISHED_READ_ACCESS_KEY_ID, PUBLISHED_READ_SECRET_ACCESS_KEY, PRIVATE_PROBE_BUCKET, PRIVATE_PROBE_KEY. No credentials, keys or response bodies are printed.');
    process.exitCode = 1; return;
  }
  const env = process.env;
  const report = await probePermissions({ endpoint: env.PUBLISHED_S3_ENDPOINT || '', publishedBucket: env.PUBLISHED_BUCKET_NAME || '', accessKeyId: env.PUBLISHED_READ_ACCESS_KEY_ID || '', secretAccessKey: env.PUBLISHED_READ_SECRET_ACCESS_KEY || '', privateBucket: env.PRIVATE_PROBE_BUCKET || '', privateSentinelKey: env.PRIVATE_PROBE_KEY || '' });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => { console.error('Storage permission verification failed. Check configuration, network access and credential scope. No credentials or remote response bodies were logged.'); process.exitCode = 1; });
}
