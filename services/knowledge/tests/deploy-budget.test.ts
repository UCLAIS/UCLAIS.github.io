import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { deployConfiguration, verifyFreeAccount } from '../scripts/deploy-knowledge';

const account = 'a'.repeat(32); const token = 'test-token-never-log';
const free = { state: 'Provisioned', price: 0, rate_plan: { id: 'free', public_name: 'Free' } };
const network = (result: unknown, extra = {}) => vi.fn(async () => Response.json({ success: true, result, ...extra }));
const template = JSON.parse(await readFile(new URL('../wrangler.bundled.jsonc', import.meta.url), 'utf8'));
describe('free-only deployment boundary', () => {
  it('only reads the exact account subscriptions endpoint, with no redirects, billing mutation or token in the URL', async () => {
    const fetcher = network([free]); await verifyFreeAccount(account, token, fetcher);
    expect(fetcher).toHaveBeenCalledOnce(); const [url, options] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`); expect(options.redirect).toBe('error'); expect(options.method).toBeUndefined(); expect(options.headers).toMatchObject({ Authorization: `Bearer ${token}` }); expect(url).not.toContain(token);
    await expect(verifyFreeAccount(account, token, network([]))).resolves.toBeUndefined();
  });
  it.each([
    { ...free, price: 5 }, { ...free, state: 'Trial' }, { ...free, state: 'AwaitingPayment' },
    { ...free, rate_plan: { id: 'workers_paid', public_name: 'Workers Paid' } },
    { ...free, rate_plan: { id: 'free', public_name: 'Paid' } },
    { ...free, rate_plan: { id: 'free', is_contract: true } }, {}, null,
  ])('rejects paid, trial and unrecognised subscriptions', async subscription => {
    await expect(verifyFreeAccount(account, token, network([subscription]))).rejects.toThrow('deployment refused');
  });
  it('fails closed on incomplete, oversized, denied and malformed responses without returning their bodies', async () => {
    for (const fetcher of [network([], { success: false }), network([], { result_info: { total_count: 2 } }), async () => new Response(token, { status: 403 }), async () => new Response(token), async () => new Response('x'.repeat(65_537))]) {
      await expect(verifyFreeAccount(account, token, fetcher)).rejects.toThrow(); await expect(verifyFreeAccount(account, token, fetcher)).rejects.not.toThrow(token);
    }
  });
  it('creates configuration containing no runtime credentials or writable storage bindings', () => {
    const config = deployConfiguration(template, 'https://knowledge.example/mcp', account); expect(config.main).toBe('../src/bundled-worker.ts'); expect(config.vars).toMatchObject({ PUBLIC_ORIGIN: 'https://knowledge.example' }); expect(JSON.stringify(config)).not.toContain(token);
  });
  it.each(['r2_buckets', 'd1_databases', 'kv_namespaces', 'ai', 'services', 'durable_objects', 'logpush', 'build', 'env', 'routes'])('refuses injected deployment capabilities: %s', key => {
    expect(() => deployConfiguration({ ...template, [key]: [] }, 'https://knowledge.example/mcp', account)).toThrow('prohibited');
  });
  it.each(['http://knowledge.example/mcp', 'https://user:secret@knowledge.example/mcp', 'https://knowledge.example/mcp?token=secret', 'https://PUBLIC_HOST_REQUIRED/mcp', 'https://knowledge.invalid/mcp'])('rejects unsafe or placeholder endpoints', endpoint => {
    expect(() => deployConfiguration(template, endpoint, account)).toThrow();
  });
  it('rejects a different Worker entry point, logging, previews and secret vars', () => {
    for (const change of [{ main: 'src/admin-worker.ts' }, { observability: { enabled: true } }, { preview_urls: true }, { vars: { API_TOKEN: token } }]) expect(() => deployConfiguration({ ...template, ...change }, 'https://knowledge.example/mcp', account)).toThrow();
  });
});
