import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { startPublicDev } from '../scripts/local-public';
import { diagnose } from '../scripts/doctor';

describe('loopback preview of GitHub knowledge', () => {
  let server: Server; let origin: string;
  beforeAll(async () => { server = await startPublicDev({ port: 0 }); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing local port'); origin = `http://127.0.0.1:${address.port}`; });
  afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve()); });
  it('includes added folder material in local retrieval', async () => {
    const response = await fetch(`${origin}/api/resources/knowledge%3Aguides%2Fadding-material.md`); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ type: 'guide', guidance: { contact: { email: 'info@uclai.co.uk' } } });
  });
  it('passes the official SDK diagnostic without an editor or cloud credential', async () => { expect((await diagnose(`${origin}/mcp`, 'public')).ok).toBe(true); });
  it('denies write routes and hostile browser origins', async () => {
    expect((await fetch(`${origin}/mcp/imports`, { method: 'POST', body: '{}' })).status).toBeGreaterThanOrEqual(400);
    expect((await fetch(`${origin}/health`, { headers: { Origin: 'https://hostile.example' } })).status).toBe(403);
  });
});
