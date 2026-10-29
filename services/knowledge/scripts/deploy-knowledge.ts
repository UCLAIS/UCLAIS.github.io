import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** A preflight, never an API to subscribe, upgrade or modify billing. */
export async function verifyFreeAccount(accountId: string, token: string, network: typeof fetch = fetch): Promise<void> {
  if (!/^[a-f0-9]{32}$/.test(accountId) || !token || /[\r\n]/.test(token)) throw new Error('Configure the society account ID and deployment token.');
  const response = await network(`https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok || !response.body) { await response.body?.cancel(); throw new Error('Cannot verify account subscriptions; deployment refused.'); }
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 65_536) { await reader.cancel(); throw new Error('Unrecognised subscription response; deployment refused.'); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: any;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Error('Unrecognised subscription response; deployment refused.'); }
  if (value?.success !== true || !Array.isArray(value.result) || (value.result_info?.total_count !== undefined && value.result_info.total_count !== value.result.length)) throw new Error('Incomplete subscription information; deployment refused.');
  // No account subscription is the default Workers Free account. A dedicated
  // free-only account also avoids silently relying on a paid/trial add-on.
  for (const subscription of value.result) {
    if (!subscription || typeof subscription !== 'object') throw new Error('Unrecognised subscription; deployment refused.');
    if (['Cancelled', 'Expired', 'Failed'].includes(subscription.state)) continue;
    const plan = subscription.rate_plan;
    if (!['Provisioned', 'Paid'].includes(subscription.state) || !['free', 'partners_free'].includes(plan?.id) || (subscription.price !== undefined && subscription.price !== 0) || plan?.externally_managed === true || plan?.is_contract === true || (plan?.public_name && !/\bfree\b/i.test(plan.public_name))) throw new Error('Only a verified free-only account is authorised; deployment refused.');
  }
}

export function deployConfiguration(template: Record<string, any>, endpoint: string, accountId: string): Record<string, unknown> {
  const allowed = new Set(['$schema', 'name', 'main', 'compatibility_date', 'compatibility_flags', 'workers_dev', 'preview_urls', 'vars', 'ratelimits', 'observability']);
  const url = new URL(endpoint);
  if (!/^[a-f0-9]{32}$/.test(accountId) || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/mcp' || /REQUIRED|\.invalid$/i.test(url.hostname)) throw new Error('Configure the exact public HTTPS MCP endpoint.');
  if (Object.keys(template).some(key => !allowed.has(key)) || template.main !== 'src/bundled-worker.ts' || template.workers_dev !== true || template.preview_urls !== false || template.observability?.enabled !== false || !Array.isArray(template.ratelimits) || template.ratelimits.length !== 1 || template.ratelimits[0].name !== 'RATE_LIMITER') throw new Error('Unexpected deployment configuration; writable bindings and paid add-ons are prohibited.');
  if (Object.keys(template.vars || {}).some(key => !['PUBLIC_ORIGIN', 'ALLOWED_ORIGINS'].includes(key))) throw new Error('Only public origin configuration may be deployed as variables.');
  return { ...template, main: '../src/bundled-worker.ts', account_id: accountId, vars: { ...template.vars, PUBLIC_ORIGIN: url.origin } };
}

async function main() {
  const directory = fileURLToPath(new URL('../', import.meta.url));
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  const token = process.env.CLOUDFLARE_API_TOKEN || '';
  const template = JSON.parse(await readFile(new URL('../wrangler.bundled.jsonc', import.meta.url), 'utf8'));
  const config = deployConfiguration(template, process.env.KNOWLEDGE_PUBLIC_MCP_URL || '', accountId);
  await verifyFreeAccount(accountId, token);
  // Require a successful build before invoking the deployment CLI.
  const snapshot = JSON.parse(await readFile(new URL('../.generated/knowledge.release.json', import.meta.url), 'utf8'));
  if (!snapshot.release?.id || !snapshot.release?.corpus?.documents?.length) throw new Error('Build the knowledge snapshot before deploying.');
  await mkdir(resolve(directory, '.generated'), { recursive: true });
  const filename = resolve(directory, '.generated/wrangler.deploy.json');
  await writeFile(filename, JSON.stringify(config, null, 2));
  console.log('Free-account preflight passed. Deploying the read-only bundled Worker; no storage services or paid plans are provisioned.');
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url)), 'deploy', '--config', filename], { cwd: directory, stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
    child.once('error', () => reject(new Error('Deployment command could not start.')));
    child.once('exit', code => code === 0 ? accept() : reject(new Error('Deployment command failed.')));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(() => {
  console.error('Knowledge deployment refused or failed. Check the free-only account, Billing Read permission, Worker deployment permission, public endpoint and successful build. No credentials or remote response bodies were logged.');
  process.exitCode = 1;
});
