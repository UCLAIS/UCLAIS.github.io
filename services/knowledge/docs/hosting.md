# Hosting and the free-tier target

Target: no paid plan or automatic upgrade. No hosting has been provisioned. The current implementation targets Cloudflare Workers and its separate public/admin/auth boundaries. Choosing another provider requires adapting those bindings and rerunning security and integration tests; a host's free plan alone does not establish application security.

## Verified limits, 29 October 2026

| Option | Relevant free allowance | Practical qualification |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests/day; 10 ms CPU/invocation | Current full-index loading needs optimisation or runtime evidence before a reliable free rollout |
| Cloudflare R2 Standard | 10 GB-month, 1 million Class A and 10 million Class B operations/month | Excess usage is metered; a free allowance is not a hard zero-spend cap |
| Cloudflare D1 | 5 GB, 5 million rows read/day, 100,000 rows written/day | Private metadata must remain within the allowance |
| Deno Deploy Free | 1 million requests, 10 CPU-hours and 150 GiB-hours memory/month; 20 GiB egress | Candidate alternative; requires porting and testing, with scaling to zero and independent resource quotas |
| Render Free | 750 service-hours/workspace/month | Sleeps after 15 minutes idle, takes about a minute to wake, and local state is ephemeral; unsuitable for reliable instant MCP connections without additional design |

Sources: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Deno Deploy](https://deno.com/deploy/pricing), [Render](https://render.com/docs/free).

Cloudflare Workers Paid has a US$5/month account minimum, plus chargeable usage. It has not been enabled or selected. Start with local tests and a free staging account, then measure CPU, cold-start behaviour, R2 operations and D1/KV usage. Do not assert that free staging is sufficient merely because request counts fit.

A local Node benchmark of the current 183-document release measured about 50–126 ms CPU to parse the roughly 5 MiB release and reconstruct the search index, versus about 1–3 ms for a warm search. These are **local Node measurements**, not deployed Cloudflare CPU measurements. They identify a likely cold-start problem under the 10 ms Free limit, and must not be presented as a passing free-tier check. Full candidate/index construction also requires measurement.

For request planning, 1,000 members × 20 questions/month × 4 MCP requests/question is 80,000 requests/month, below Deno's request allowance. This is an illustrative estimate, not measured traffic, and excludes administrative and diagnostic traffic. CPU, memory time and egress can become limiting before request count. No free provider gives an unrestricted production-capacity guarantee.

The current preference remains Cloudflare if feasible. Do not migrate authentication or weaken public/draft isolation merely to change hosting. A possible migration needs a concrete storage/auth adapter design and the same revocation, approval, CSRF, token-audience, crash-recovery and read-only-permission checks before launch.

Luma event retrieval uses the [official public calendar subscription](https://help.luma.com/p/ical-syncing), not Luma's paid management API. There is no server-side answer-generation model or associated model API charge.
