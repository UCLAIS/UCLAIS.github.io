import { Github } from './github';

type State = 'ready' | 'degraded' | 'unavailable' | 'unknown';
export interface Check { id: string; name: string; state: State; detail: string; url: string; checkedAt: string }
export interface WebsiteStatus { releaseId: string; commit: string; materials: { path: string; presentation?: string; firstSlide?: string; slideCount: number }[] }
async function json(url: string) {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } });
  if (!response.ok) { await response.body?.cancel(); throw new Error('unavailable'); }
  return await response.json() as any;
}

export async function toolingStatus(github: Github) {
  const checkedAt = new Date().toISOString();
  const [website, mcp, events, workflows] = await Promise.allSettled([
    json('https://uclai.co.uk/knowledge-status.json'),
    json('https://mcp.uclai.co.uk/health'),
    json('https://mcp.uclai.co.uk/api/events'),
    github.repo('/actions/runs?branch=main&per_page=30'),
  ]);
  const checks: Check[] = [];
  const add = (id: string, name: string, state: State, detail: string, url: string) => checks.push({ id, name, state, detail, url, checkedAt });
  const manifest: WebsiteStatus | undefined = website.status === 'fulfilled' && typeof website.value?.releaseId === 'string' && Array.isArray(website.value?.materials) ? website.value : undefined;
  add('website', 'Website', manifest ? 'ready' : 'unknown', manifest ? `Live build ${manifest.commit.slice(0, 7)} · ${manifest.materials.length} learning resources.` : 'The publication manifest could not be verified. Open the website and deployment run to investigate.', 'https://uclai.co.uk/');
  const releaseId = mcp.status === 'fulfilled' && mcp.value?.status === 'ready' ? mcp.value.releaseId : undefined;
  add('mcp', 'Knowledge MCP', !releaseId ? 'unavailable' : manifest && manifest.releaseId !== releaseId ? 'degraded' : 'ready', !releaseId ? 'The public knowledge health check failed.' : manifest && manifest.releaseId !== releaseId ? 'The website and MCP currently serve different knowledge releases. Check both deployments.' : 'The public endpoint reports a published knowledge release.', 'https://mcp.uclai.co.uk/health');
  const calendar = events.status === 'fulfilled' ? events.value?.calendar : undefined;
  const fresh = calendar?.status === 'available' && Date.parse(calendar.expiresAt) > Date.now();
  add('luma', 'Luma events', fresh ? calendar.skippedCount ? 'degraded' : 'ready' : 'unavailable', fresh ? `Feed retrieved ${calendar.fetchedAt}. ${calendar.skippedCount || 0} entries skipped. This checks the published feed; registration availability remains on Luma.` : 'A fresh calendar feed could not be verified. This does not establish that there are no events.', 'https://luma.com/UCLAISociety');
  const decks = manifest?.materials.filter(item => item.slideCount > 0) || [];
  // Sample one cover per deck, bounded to eight. Never fetch a manifest-controlled external URL.
  const samples = await Promise.allSettled(decks.slice(0, 8).map(async deck => {
    if (!/^\/materials\/[A-Za-z0-9_./-]+\.(webp|png|jpe?g)$/.test(deck.firstSlide || '') || deck.firstSlide!.split('/').some(part => part === '..')) throw new Error('invalid_asset');
    const response = await fetch(`https://uclai.co.uk${deck.firstSlide}`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(12000) });
    if (!response.ok || !response.headers.get('Content-Type')?.startsWith('image/')) throw new Error('missing_asset');
  }));
  add('slides', 'Slide library', !manifest || !decks.length ? 'unknown' : samples.some(item => item.status === 'rejected') ? 'degraded' : 'ready', !manifest ? 'The website build manifest is unavailable.' : !decks.length ? 'No published decks were recorded in the build.' : `${decks.length} decks validated at build time. Spot checked ${samples.length} cover images on the live site.`, 'https://uclai.co.uk/our-initiatives/tutorials/');
  const runs = workflows.status === 'fulfilled' && Array.isArray(workflows.value?.workflow_runs) ? workflows.value.workflow_runs : [];
  return { checks, websiteRelease: manifest?.releaseId || null, mcpRelease: releaseId || null, workflows: ['.github/workflows/deploy.yml', '.github/workflows/knowledge.yml'].map(path => {
    const run = runs.find((item: any) => item.path === path);
    return run ? { name: run.name, status: run.status, conclusion: run.conclusion, commit: run.head_sha, url: run.html_url, updatedAt: run.updated_at } : { name: path.includes('knowledge') ? 'Knowledge deployment' : 'Website deployment', status: 'unknown', conclusion: null, url: `https://github.com/UCLAIS/UCLAIS.github.io/actions`, commit: null, updatedAt: null };
  }), checkedAt, note: 'Checks run when you refresh. A healthy endpoint does not prove compatibility with a particular ChatGPT or Claude connection.' };
}
