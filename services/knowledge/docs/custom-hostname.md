# Public MCP hostname with IONOS DNS

Target connection URL: `https://mcp.uclai.co.uk/mcp`. This is a proposed hostname until DNS, TLS and the real MCP diagnostic succeed; keep displaying the working Worker URL until then.

IONOS remains the registrar and DNS provider. A small Cloudflare Pages Function forwards only public MCP and retrieval routes to the existing public Worker through a `PUBLIC_KNOWLEDGE` service binding. The gateway has no draft access, editor credentials, writable storage or model API. Approved content continues to deploy to the existing Worker from GitHub, so knowledge updates need no second upload.

Cloudflare Workers Custom Domains require an active Cloudflare DNS zone. Pages supports an externally managed subdomain through a CNAME instead, so the society's website and email DNS need no migration. See [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [Pages custom subdomains](https://developers.cloudflare.com/pages/configuration/custom-domains/#add-a-custom-subdomain) and [Pages service bindings](https://developers.cloudflare.com/pages/functions/bindings/#service-bindings).

## Free-only deployment and activation

The existing account must remain Workers Free with no paid subscriptions or upgrades. Pages Functions share the Workers Free request quota. Budget conservatively for both a gateway invocation and a public Worker invocation per proxied request. Quota exhaustion can stop the service; this setup does not authorise paid overages. See [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).

1. Build with `pnpm hostname:build` in `services/knowledge`. The two public deployment files are in `.generated/hostname/`. No `.env` or private files belong in this upload.
2. Create the Pages Direct Upload project **uclai-mcp** in the society's existing free Cloudflare account. Upload those files, including `_worker.js`; the dashboard supports this advanced-mode file. Configure its production service binding: **PUBLIC_KNOWLEDGE → uclai-knowledge-public-staging**, then redeploy. Do not bind the admin/auth Workers, AI, R2, D1, KV or any other service. `wrangler.hostname.jsonc` records the same configuration for a scoped Pages-capable CLI token. The current Worker deployment token may not have Pages permissions; never use the Global API Key as a workaround.
3. Run the existing SDK doctor against `https://uclai-mcp.pages.dev/mcp`. Verify initialisation, all five read-only tools, search, a tutorial cell, live event freshness and rejected private routes. The original Worker rate limiter must still run; verify edge `CF-Connecting-IP` reaches it through the service binding. A custom hostname does not bypass a client's own network restrictions or install a connector.
4. In the Pages project, associate **mcp.uclai.co.uk** as a custom domain before changing DNS. In IONOS, add only **CNAME mcp → uclai-mcp.pages.dev**. Preserve every root, website, email and other subdomain record. An existing conflicting `mcp` record needs review before replacement. A redirect or bare CNAME to `workers.dev` is not a substitute for this setup.
5. Wait for the domain and TLS certificate to become active. Run the SDK doctor against `https://mcp.uclai.co.uk/mcp` and check health, source citations, query/fetch and events. Test actual Claude/ChatGPT connections separately.
6. Only after those checks, set the **repository** website variables `KNOWLEDGE_PUBLIC_MCP_URL=https://mcp.uclai.co.uk/mcp` and `KNOWLEDGE_PUBLIC_API_URL=https://mcp.uclai.co.uk`. Update the ignored local website `.env` values to match and rebuild the site.

Keep the knowledge-staging **environment** deployment variable pointing at the original Worker URL. It controls that Worker's exact `PUBLIC_ORIGIN` host check, and the gateway deliberately calls that origin. The existing Worker stays reachable for existing clients and recovery. Do not replace its endpoint variable with the gateway URL.

The gateway code has a separate Pages deployment. Changes to its code require review, tests and a new upload; content-only changes continue through the existing GitHub knowledge workflow. If activation fails, keep the original connection URL on the website and correct the new subdomain setup. No production host is changed merely by building or committing these files.
