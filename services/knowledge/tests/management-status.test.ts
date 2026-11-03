import { afterEach, expect, it, vi } from 'vitest';
import { Github } from '../src/management/github';
import { toolingStatus } from '../src/management/status';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('reports mismatched releases and an expired feed despite successful historical workflows', async () => {
  const github = new Github('unused');
  vi.spyOn(github, 'repo').mockResolvedValue({ workflow_runs: [{ path: '.github/workflows/deploy.yml', name: 'Website', status: 'completed', conclusion: 'success', head_sha: 'a'.repeat(40), html_url: 'https://github.com/UCLAIS/UCLAIS.github.io/actions/runs/1' }] });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('knowledge-status.json')) return Response.json({ releaseId: 'old', commit: 'a'.repeat(40), materials: [{ slideCount: 1, firstSlide: '/materials/deck/page.webp' }] });
    if (url.endsWith('/health')) return Response.json({ status: 'ready', releaseId: 'new' });
    if (url.endsWith('/api/events')) return Response.json({ calendar: { status: 'available', expiresAt: '2020-01-01T00:00:00Z' } });
    return new Response(null, { status: 200, headers: { 'Content-Type': 'image/webp' } });
  }));
  const report = await toolingStatus(github);
  expect(report.checks.find(item => item.id === 'mcp')?.state).toBe('degraded');
  expect(report.checks.find(item => item.id === 'luma')?.state).toBe('unavailable');
  expect(report.checks.find(item => item.id === 'slides')?.detail).toContain('Spot checked 1');
});

it('does not turn an unavailable check or untrusted asset URL into a healthy result', async () => {
  const github = new Github('unused'); vi.spyOn(github, 'repo').mockRejectedValue(new Error('unavailable'));
  const network = vi.fn(async (url: string) => {
    if (url.endsWith('knowledge-status.json')) return Response.json({ releaseId: 'a', commit: 'a'.repeat(40), materials: [{ slideCount: 1, firstSlide: 'https://evil.example/private' }] });
    return new Response(null, { status: 503 });
  }); vi.stubGlobal('fetch', network);
  const report = await toolingStatus(github);
  expect(report.checks.find(item => item.id === 'mcp')?.state).toBe('unavailable');
  expect(report.checks.find(item => item.id === 'slides')?.state).toBe('degraded');
  expect(report.workflows.every(item => item.status === 'unknown')).toBe(true);
  expect(network.mock.calls.every(([url]) => !url.includes('evil.example'))).toBe(true);
});
