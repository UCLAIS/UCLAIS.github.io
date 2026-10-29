# AI Society knowledge service

The current launch route is **GitHub files → reviewed merge → validated snapshot → one read-only Cloudflare Worker**. Add tutorials, Nexus sessions and FAQs under the root [`knowledge/`](../../knowledge/README.md) folder. GitHub Actions checks every relevant pull request and can publish successful `main` builds after the one-time account setup. No hosted resources have been provisioned yet.

This replaces the original editor MCP for the free launch: maintainers use their existing GitHub permissions and review changes on GitHub. The public MCP has no GitHub token, private draft database, writable storage binding or publishing tool. The original three-Worker OAuth/editor implementation remains available for separate evaluation; its R2 deployment is on hold because it can incur overage charges.

The service performs retrieval and full-text search. It calls no answer-generation model, embedding API or paid AI service. Each member's own assistant generates the answer under that provider's account terms.

## Add and publish knowledge

Read the [folder contribution guide](../../knowledge/README.md) for examples, optional metadata, notebooks, PDF page references, withdrawals and one-time deployment settings. A Markdown heading and body are enough. Templates and files marked `draft` or `review-required` stay out of the MCP. **All files in this public GitHub repository are public, including drafts.** Confidential material belongs elsewhere.

Merging a change approves its publication. Configure GitHub branch protection and required knowledge checks to enforce review; the workflow cannot establish that review occurred on an unprotected branch. Pull requests do not receive deployment secrets. Source bodies are never executed. Notebook outputs are discarded, imported links are not crawled, and metadata, credential patterns, paths, input sizes and release size are validated before deployment.

## Where the data lives

Editable material lives in `knowledge/`. The approved portal and external tutorial archive is pinned in `data/bootstrap-corpus.json`; refresh it separately with the existing importer and review the changes. Missing, inaccessible and rights-unconfirmed sources remain in its source registry rather than being invented or silently imported.

The build writes an ignored `.generated/knowledge.release.json` containing the approved documents, metadata, source gaps and MiniSearch index. Deployment bundles it into Worker code. **The current route uses no R2, D1 or KV.** The public runtime reads its immutable bundled release and caches the approved public Luma calendar feed for up to 12 hours. No database holds member conversations, and application code does not retain raw queries.

Each result includes its release ID. Only the currently deployed release is served: fetching a retired version fails explicitly. Remove a new file to delete its document; use `knowledge/withdrawn.json` to suppress archive documents or live Luma IDs. Keep withdrawals when reverting a content change. Git history and copies already downloaded by others retain earlier text.

## Local checks

Use Node 24, pnpm 11.25.0 and Python with the pinned PDF dependencies. From this directory:

```sh
pnpm install --frozen-lockfile
python3 -m pip install -r requirements-pdf.txt
pnpm knowledge:build
pnpm typecheck
pnpm test
pnpm build
```

`pnpm build` creates the snapshot and performs a Wrangler dry run without deploying. `pnpm build:legacy` checks the original three Workers. The default local preview includes the GitHub folder too; `pnpm dev -- --corpus data/bootstrap-corpus.json` previews only the pinned archive. The read-only CLI diagnostic is `pnpm doctor --url https://PUBLIC_HOST/mcp`. SDK tests do not prove real ChatGPT or Claude compatibility.

Real `.env`/`.dev.vars`, private imports, generated releases, local Wrangler databases, keys and logs are ignored. Blank examples are tracked. Use `.env.example` for local CLI configuration, GitHub environment secrets for deployment, and public website variables only for connection URLs. Never copy deployment or editor credentials into Docusaurus variables. Inspect the actual Git diff before pushing because ignore rules do not remove tracked files.

## Public interface

MCP at `/mcp` exposes only `search`, `fetch`, `list_learning_paths`, `get_learning_path` and `list_events`. HTTP retrieval is available at `/health`, `/api/search`, `/api/resources/:id`, `/api/paths` and `/api/events`. Fetch accepts `releaseId` and `sectionId` so tutorial cells retain their source and version.

Luma uses the single approved public calendar subscription with no API key. Event responses include retrieval time, expiry and feed version separately from the knowledge release. Failed feeds and unsupported entries are reported honestly; an unavailable feed does not establish that no events exist. Attendees and private account records are not queried.

Public responses include an AI accuracy disclaimer, source/date guidance, the society's principles and `info@uclai.co.uk` for unanswered, conflicting or out-of-scope questions. An external assistant still controls how it phrases its answer. The site provides short ChatGPT, Claude and Gemini setup instructions and an optional public WebMCP adapter.

## Deployment and acceptance

The [GitHub setup instructions](../../knowledge/README.md#one-time-deployment-setup) describe the free-only account check and required secret/variables. The deployment script reads subscription information and refuses paid, trial, incomplete or unrecognised account states. It never upgrades a plan or provisions storage. Free quotas can cause an outage; rate limiting does not guarantee availability or a global spend cap if an operator later changes the account plan.

Before enabling publishing, protect `main`, inspect the society account's actual subscriptions, and validate deployed startup/request CPU on Workers Free. Then run the [real-client acceptance checks](docs/connections.md). Local runtime success cannot establish production latency, quota adequacy or account permissions. Preserve the existing website deployment and do not expose production connection URLs until staging passes.

The [security model](docs/security.md), [hosting evidence](docs/hosting.md) and [deployment runbook](docs/deployment.md) distinguish this route from the retained legacy editor architecture. No credentials or member transcripts belong in acceptance records.
