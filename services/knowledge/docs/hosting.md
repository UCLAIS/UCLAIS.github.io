# Current free launch route

The GitHub folder build now bundles approved knowledge and its search index directly into one public Worker. `wrangler.bundled.jsonc` contains no R2/D1/KV bindings. This removes the original R2 overage exposure and editor hosting from the launch. The deployment script requires a verified free-only account; GitHub publication remains disabled until account settings and secrets are configured. See the [contribution/setup guide](../../../knowledge/README.md).

A local workerd prototype loaded 183 approved documents, completed an MCP connection in about 23 ms after runtime startup and retrieved real tutorial cells. The bundle was about 5.9 MB uncompressed / 1.2 MB gzip, with about 40 MB used heap. These are local measurements, not deployed CPU, startup or latency guarantees. The production entry point now loads the immutable index at module startup rather than during the first request. Measure actual Workers Free startup and request CPU before launch, especially broad searches and event parsing.

The implemented 184-document Worker dry-run bundle is 6,879 KiB uncompressed / 1,273 KiB gzip. Wrangler's local startup profile recorded a 233 ms profile window, including about 62 ms active time. This is below the separate 1-second startup ceiling locally; it does not establish compliance with deployed startup or the 10 ms request CPU limit. Its actual Workers runtime integration tests exercise MCP initialisation, the GitHub-added guide, notebook cells and the calendar adapter.

Workers Free has a daily request cutoff and a per-request CPU limit. The workflow never upgrades it. No model API, R2 or other paid integration is used by this route. A bot can exhaust the free quota and cause an outage. The subscription check is a deployment preflight, not a permanent provider spending lock; an account administrator must keep paid products disabled. Use standard public-repository Actions runners without paid caches/artifacts. [Cloudflare pricing](https://developers.cloudflare.com/workers/platform/pricing/), [limits](https://developers.cloudflare.com/workers/platform/limits/).

The original architecture and provider investigation below are retained for context. Their R2 provisioning commands remain on hold and do not describe the current launch configuration.

# Hosting and the free-tier target

Budget: **£0 is a hard requirement**, confirmed on 29 October 2026. No paid plan, automatic upgrade or service with chargeable overages is authorised. On reaching a free quota, the service must stop or reject requests rather than incur charges. A usage estimate, application rate limiter or billing alert is not proof of a provider-enforced zero-spend limit.

**Deployment hold:** the current R2-based storage configuration does not meet this requirement because R2 charges for usage beyond its free allowance. Do not provision its buckets, activate R2 billing or deploy the default configuration. Replace the storage approach and verify the selected providers' billing behaviour, then rerun the storage-permission, publication-recovery and integration checks before deployment. Cloudflare remains the preferred host where feasible; preserve the separate public/admin/auth boundaries and actual read-only public storage access.

No hosting has been provisioned. The current implementation targets Cloudflare Workers. Choosing another provider requires adapting those bindings and rerunning security and integration tests; a host's free plan alone does not establish application security.

The MCP uses retrieval and full-text search, with no hosted answer-generation model, paid embedding API or required OpenAI, Anthropic or Gemini API key. A member's chosen assistant has its own account terms and usage limits.

## Verified limits, 29 October 2026

| Option | Relevant free allowance | Practical qualification |
| --- | --- | --- |
| Cloudflare Workers | 100,000 requests/day; 10 ms CPU/invocation | Current full-index loading needs optimisation or runtime evidence before a reliable free rollout |
| Cloudflare R2 Standard | 10 GB-month, 1 million Class A and 10 million Class B operations/month | Excess usage is metered; a free allowance is not a hard zero-spend cap |
| Cloudflare D1 | 5 GB, 5 million rows read/day, 100,000 rows written/day | Private metadata must remain within the allowance |
| Deno Deploy Free | Advertised: 1 million requests, 10 CPU-hours and 150 GiB-hours memory/month; 20 GiB egress; 1 GiB KV | Free compute applications pause at exhausted quotas. Unverified organisations have lower limits; full allowances require card verification. Storage enforcement and access permissions still need verification. |
| Render Free | 750 service-hours/workspace/month | Sleeps after 15 minutes idle, takes about a minute to wake, and local state is ephemeral; unsuitable for reliable instant MCP connections without additional design |

Sources: [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [R2](https://developers.cloudflare.com/r2/pricing/), [D1](https://developers.cloudflare.com/d1/platform/pricing/), [Deno Deploy](https://deno.com/deploy/pricing), [Render](https://render.com/docs/free).

Cloudflare Workers Paid has a US$5/month account minimum, plus chargeable usage. It has not been enabled or selected. Start with local tests and a free staging account, then measure CPU, cold-start behaviour, R2 operations and D1/KV usage. Do not assert that free staging is sufficient merely because request counts fit.

A local Node benchmark of the current 183-document release measured about 50–126 ms CPU to parse the roughly 5 MiB release and reconstruct the search index, versus about 1–3 ms for a warm search. These are **local Node measurements**, not deployed Cloudflare CPU measurements. They identify a likely cold-start problem under the 10 ms Free limit, and must not be presented as a passing free-tier check. Full candidate/index construction also requires measurement.

For request planning, 1,000 members × 20 questions/month × 4 MCP requests/question is 80,000 requests/month, below Deno's request allowance. This is an illustrative estimate, not measured traffic, and excludes administrative and diagnostic traffic. CPU, memory time and egress can become limiting before request count. No free provider gives an unrestricted production-capacity guarantee.

The current preference remains Cloudflare if feasible. Do not migrate authentication or weaken public/draft isolation merely to change hosting. A possible migration needs a concrete storage/auth adapter design and the same revocation, approval, CSRF, token-audience, crash-recovery and read-only-permission checks before launch.

Luma event retrieval uses the [official public calendar subscription](https://help.luma.com/p/ical-syncing), not Luma's paid management API. There is no server-side answer-generation model or associated model API charge.

## Deno billing investigation, 29 October 2026

Deno's [current Deploy changelog](https://docs.deno.com/deploy/changelog/#september-26th-2025) states that Free organisations exceeding requests, bandwidth, CPU or memory time have their applications paused until the next billing cycle. Pro organisations are billed for overages; Pro spend limits do not make its subscription free. The [current pricing page](https://deno.com/deploy/pricing) lists the Free compute and KV allowances separately. The changelog also says full Free allowances require credit-card verification; inspect the smaller cardless allowance before assuming the advertised capacity is available.

Cloudflare [Workers Free](https://developers.cloudflare.com/workers/platform/limits/#daily-requests) also rejects traffic after its daily request quota, and Workers KV Free operations fail at their quotas. These are different from [R2's metered free allowance](https://developers.cloudflare.com/r2/pricing/). Billing alerts and per-IP rate limits do not substitute for a provider-enforced cutoff when traffic can be distributed across many bots.

Deno Free is a candidate for a trial, not an approved replacement for the whole architecture. Moving compute while retaining R2 leaves its billing exposure in place. Before porting or deploying:

- Verify the actual organisation is on Free, has no paid upgrades or billable external integrations, and record its applicable quotas.
- Verify cutoff behaviour for all storage, KV reads/writes, revision storage and other enabled products; compute suspension alone does not establish this.
- Design and test public read-only storage access, private draft isolation, conditional publication, recovery and withdrawal. A read-only TypeScript interface over a writable KV connection is insufficient.
- Confirm the official Cloudflare OAuth provider and the existing D1/private-object bindings have a supported replacement or a deliberate, tested hybrid design. Changing hosting does not automatically port these protections.
- Retain bounded requests, caching and rate limits to conserve the available quota. A bot may still exhaust a Free quota and cause an outage until reset; an uptime guarantee is not part of the zero-spend requirement.

No Deno account configuration, migration or deployment has been completed. The independent council review is incomplete because the Claude CLI is not signed in. The findings above are based on official provider documentation, not a completed migration review.
