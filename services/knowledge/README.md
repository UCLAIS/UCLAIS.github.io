# AI Society knowledge service

The public MCP serves approved releases to members' own assistants. The editor MCP uses GitHub identities and explicit maintainer roles to prepare shared drafts. Publishing, rollback, withdrawal and role changes require an authenticated browser review.

This package does not call a language model. Knowledge is retrieved with citations; each connected assistant generates its own answer. The existing Docusaurus/GitHub Pages site remains separate from the Worker deployments.

Public responses include society guidance: AI-generated answers may be incorrect or out of date; check sources, and email `info@uclai.co.uk` when records cannot answer, are conflicting or unavailable, or a question needs committee judgement. The MCP instructions ask connected assistants to explain the gap and give that contact. The society's purpose and eight principles are linked from the guidance and connection page. The server supplies this guidance but cannot guarantee how an external assistant phrases its answer.

## Local development

Use Node 24 and pnpm 11.25.0. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm dev
```

Copy `.env.example` to `.env` for local CLI settings. The scripts load it automatically, while exported variables take precedence. The repository-root `.env.example` contains only public website URLs; supply them to the website build environment. Never copy editor or storage credentials into the website environment. Real `.env`/`.dev.vars` files, private imports, local databases, keys and logs are ignored; templates contain empty values only.

For local auth/public Worker secrets, copy the matching `.dev.vars.auth.example` or `.dev.vars.public.example` and pass that file explicitly with Wrangler's `--env-file` flag. Do not share a combined privileged secret file with the public Worker. Deployed secrets use `wrangler secret put`.

## Where the data lives

Before deployment, `data/bootstrap-corpus.json` holds approved public material, while `data/corpus.json` and `data/raw/` contain local imports which may still need rights review. Only the public bootstrap and body-free inventory belong in Git. Local Wrangler state stays in ignored `.wrangler/`.

After deployment, the separate published R2 bucket holds approved immutable release documents and their MiniSearch index. Private R2 holds draft/candidate bodies; D1 stores draft revisions, maintainer roles, browser approvals, audit events and aggregate counters; OAuth KV holds service-token state. Editing does not change public answers until a publisher approves the candidate in the browser. The public Worker can read only the published bucket. Member conversations are not stored by this service, and raw member queries are not retained by default.

`dev` runs a loopback-only public HTTP/MCP adapter using the checked-in `data/bootstrap-corpus.json` and the same public handler as the Worker. It does not run authentication, grant roles, expose an editor service or publish to Cloudflare. No remote credentials or re-import are required. Missing or unapproved source bodies remain absent. Pass `--corpus` to use a freshly imported corpus.

Run `pnpm ingest` separately to refresh the source inventory and proposed imported material. This can access approved external sources; inspect the resulting report before staging an update.

In another terminal:

```sh
pnpm run doctor --url http://127.0.0.1:8787/mcp
```

The doctor uses the official MCP SDK v2 to initialise a connection, inspect the expected public tools and run one read-only search. It does not print retrieved text, tokens or server response bodies. Run `pnpm run doctor --help` for environment options. These checks do not establish real ChatGPT or Claude compatibility.

`scripts/upload.ts` stages a local corpus through the authenticated editor `/mcp/imports` route using `KNOWLEDGE_EDITOR_ACCESS_TOKEN`. It cannot publish. `scripts/storage-permissions.ts` provides an explicit, expected-denial deployment probe; read the runbook before running its disposable write/delete attempts.

## Service boundaries

| Deployment | Access | Storage |
| --- | --- | --- |
| Public Worker | Anonymous, approved release retrieval | Published bucket via bucket-scoped **Object Read** S3 credentials; no writable R2/D1 bindings |
| Admin Worker | Resource-bound OAuth bearer tokens for MCP; authenticated browser sessions for review | Private D1/R2, published R2 write binding |
| OAuth Worker | GitHub sign-in, MCP authorisation | OAuth state/tokens; token validation exposed to admin through a service binding |

Public tools: `search`, `fetch`, `list_learning_paths`, `get_learning_path`, `list_events`. Editor tools prepare drafts and immutable review candidates. No editor MCP tool can publish or manage roles.

Use `source_status` to inspect the complete inventory or a draft's import report. `refresh_sources` stages up to five registered notebook, Markdown or Python sources from the five allowlisted teaching repositories. It checks the latest commit, Git blob hash and licence, preserves curated corrections, and returns a new private draft and conflicts. Use the offline importer and authenticated uploader for full refreshes, PDFs, slides and recordings. Every refresh still requires candidate preparation and browser review before publication.

Public HTTP routes: `GET /health`, `GET /api/search?query=…`, `GET /api/resources/:id`, `GET /api/paths`, `GET /api/events`; MCP uses `/mcp`. Resource fetches can specify `?releaseId=…` to retain the version returned by search and `sectionId=…` to retrieve a section. The service reads the current release pointer afresh and caches only immutable releases.

`list_events` and `/api/events` additionally read the society's approved public Luma iCalendar subscription, without an API key. They return upcoming events with source links, a feed version, retrieval time and expiry. Public edge caching honours Luma's advertised 12-hour refresh interval. This is live calendar data controlled on Luma, separate from immutable knowledge releases and draft publication. Missing feeds and unsupported entries remain visible as gaps. Guest lists, registrations and account records are neither queried nor retained. Reviewed withdrawal can suppress live event IDs too.

Imported content is untrusted data. MDX/components and notebook cells are never executed. Notebook outputs are omitted. Imports propose changes; they cannot overwrite reviewed corrections or activate a release. See the source inventory/report generated in `data/` for inaccessible, blocked and review-required material.

Imports redact recognisable credentials from teaching text and cells; release validation rejects remaining credential-like content. This does not prove arbitrary material is non-sensitive, so inspect proposed content before publication. Private source caches remain ignored by Git.

## Connecting and staging

See the [staging provisioning runbook](docs/deployment.md) and [connection setup and acceptance checks](docs/connections.md). Deployment and GitHub OAuth provisioning require society-controlled accounts and real credentials. `pnpm build` only bundles the Workers and does not deploy anything.

For the website connection page, set these **public** build variables before the Docusaurus build:

```sh
KNOWLEDGE_PUBLIC_MCP_URL=https://PUBLIC_HOST/mcp
KNOWLEDGE_EDITOR_MCP_URL=https://EDITOR_HOST/mcp
KNOWLEDGE_PUBLIC_API_URL=https://PUBLIC_HOST
```

Values flow through `customFields.knowledge`. Never put credentials, bearer tokens or GitHub secrets in Docusaurus config. If URLs are absent, `/connect/` shows deployment pending. Add the website's exact origin to the public API's allowed origins for its read-only diagnostic and optional WebMCP adapter.

Do not change production DNS until staging has a reviewed release, a passing SDK diagnostic and actual ChatGPT/Claude acceptance evidence. Keep staging and production storage, OAuth applications and secrets separate.

## Checks and operations

The dedicated GitHub Actions workflow runs locked dependency installation, type checks, security/integration tests and non-deploying Worker bundles. The existing website workflows continue to check/build Docusaurus.

Production acceptance additionally requires testing real R2 credential permissions, live OAuth and revocation, publication recovery and actual assistant clients. Local/memory tests cannot prove deployed account or bucket configuration. Record date, release, client and observed results without storing member chat transcripts.

Monitor health, authentication failures, import status and publication attempts. Do not enable raw request-body, query-string, cookie or authorisation-header logging. Follow the threat model and deployment runbook for approval boundaries, interrupted publications and withdrawals. Browser approval is an authorisation boundary, not proof of human presence or prompt-injection immunity.
