import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { diagnose, parseEndpoint } from '../scripts/doctor';

const servers: Server[] = [];
async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(); }); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No local test port');
  return `http://127.0.0.1:${address.port}/mcp`;
}
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });

describe('connection diagnostic boundaries', () => {
  it('accepts HTTPS and explicit loopback development endpoints', () => {
    expect(parseEndpoint('https://knowledge.example/mcp').protocol).toBe('https:');
    expect(parseEndpoint('http://127.0.0.1:8787/mcp').hostname).toBe('127.0.0.1');
    expect(parseEndpoint('http://localhost:8787/mcp').hostname).toBe('localhost');
  });

  it.each([
    'https://user:secret@example.test/mcp',
    'https://example.test/mcp?token=secret',
    'https://example.test/mcp#secret',
    'http://example.test/mcp',
    'http://localhost.example.test/mcp',
    'file:///tmp/mcp',
  ])('rejects credential-bearing or unsafe endpoint %s', endpoint => {
    expect(() => parseEndpoint(endpoint)).toThrow();
  });

  it('redacts a remote error body that reflects credentials or draft text', async () => {
    const secret = 'do-not-log-editor-token-or-draft';
    const endpoint = await listen(createServer((_, response) => {
      response.writeHead(503, { 'Content-Type': 'text/plain' });
      response.end(secret);
    }));
    const result = await diagnose(endpoint, 'editor', secret);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.error).toContain('Connection check failed');
  });

  it('does not follow a redirect while carrying an editor token', async () => {
    let redirectedRequests = 0;
    const destination = await listen(createServer((_, response) => { redirectedRequests++; response.end('unexpected'); }));
    const source = await listen(createServer((_, response) => { response.writeHead(307, { Location: destination }); response.end(); }));
    const result = await diagnose(source, 'editor', 'do-not-forward');
    expect(result.ok).toBe(false);
    expect(redirectedRequests).toBe(0);
  });
});
