# Staging provisioning and deployment

This runbook requires a society-controlled Cloudflare account and GitHub OAuth application. The committed configurations contain deliberate placeholders. No public connection is ready until these steps and the real-client acceptance checks pass.

The target is free hosting where feasible. Keep the account on Workers Free during evaluation; do not enable a paid plan or automatic upgrade. The current search index has a likely cold-start CPU issue under the free request limit, so a successful bundle is not a successful free-tier deployment. See [hosting limits and measurements](hosting.md) before rollout. Storage free allowances can still have metered overages; review account billing settings and usage limits.

Use a separate set of buckets, database, KV namespace, OAuth application and credentials for production. Keep the existing `uclai.co.uk` website and GitHub Pages deployment in place.

## Local configuration and Git hygiene

Copy the repository-root `.env.example` to `.env` for **public website URLs only**. For a local Node 24 website build, run `node --env-file-if-exists=.env node_modules/@docusaurus/core/bin/docusaurus.mjs build` from the repository root. CI reads the three public URLs from GitHub repository variables.

Copy `services/knowledge/.env.example` to that directory's `.env` for private CLI settings. Use `pnpm run upload`, `pnpm run doctor` and `pnpm run permissions:probe`; those scripts load the service `.env`. Leave token/credential fields empty until they are provisioned. Never put real credentials in a tracked Wrangler config, public website variables or an example file.

The per-Worker `.dev.vars.*.example` templates are for local development only; copy one and pass it explicitly with `wrangler dev --config wrangler.auth.jsonc --env-file .dev.vars.auth` (or the matching public files). Use `wrangler secret put` for deployed Worker secrets. Git excludes real env files, private imports, local storage, private key files and logs. Ignore rules do not remove files which were already tracked, so inspect the actual push contents too.

## 1. Provision staging resources

From `services/knowledge`, authenticate Wrangler to the intended Cloudflare account. Create these resources:

```sh
pnpm exec wrangler r2 bucket create uclai-knowledge-published-staging
pnpm exec wrangler r2 bucket create uclai-knowledge-private-staging
pnpm exec wrangler d1 create uclai-knowledge-private-staging
pnpm exec wrangler kv namespace create OAUTH_KV
```

Put the returned D1 identifier in **both** auth/admin configs and the KV identifier in the auth config. Keep both buckets private with no `r2.dev` access or public custom domain. The public service is the only anonymous retrieval interface.

Choose the three staging Worker origins, using the deployed Worker names and the account's `workers.dev` subdomain or dedicated staging custom domains. Configure exact origins without trailing slashes:

| Setting | Configuration |
| --- | --- |
| `PUBLIC_ORIGIN` | Public Worker's origin, in public config |
| `AUTH_ORIGIN` | OAuth Worker's origin, identically in auth and admin configs |
| `ADMIN_ORIGIN` | Admin Worker's origin, identically in auth and admin configs |
| `PUBLISHED_S3_ENDPOINT` | Account's R2 S3 HTTPS endpoint |
| `PUBLISHED_BUCKET_NAME` | Same published bucket as admin's `PUBLISHED_BUCKET` binding |
| `AUTH_SERVER` | Admin service binding to the deployed OAuth Worker |

Retain the public Worker's rate limiter. The public config must have **no** D1, writable R2 or admin service bindings. Leave request-log observability off; configure only aggregate/redacted operational metrics if needed.

Apply the private database migration:

```sh
pnpm exec wrangler d1 migrations apply PRIVATE_DB --remote --config wrangler.admin.jsonc
```

The migration bootstraps numeric GitHub ID `57414242` as the administrator. Verify that this is the intended society maintainer before deployment; no other GitHub account receives access automatically.

## 2. Register identity and storage credentials

Create a GitHub OAuth app under a society-controlled owner. Set its callback to `AUTH_ORIGIN/github/callback` and its homepage to `ADMIN_ORIGIN`. Put its client ID into the auth config; store its client secret through the secret prompt:

```sh
pnpm exec wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.auth.jsonc
```

The implementation requests no GitHub repository or email scopes. The GitHub token is used only to retrieve the verified numeric identity and is discarded. MCP tokens are issued by the OAuth Worker for the exact `ADMIN_ORIGIN/mcp` resource.

Create separate R2 S3 credentials with **Object Read** access scoped to `uclai-knowledge-published-staging` only. Do not use account-wide or administrative storage credentials for the public Worker. Store its two secrets:

```sh
pnpm exec wrangler secret put PUBLISHED_READ_ACCESS_KEY_ID --config wrangler.public.jsonc
pnpm exec wrangler secret put PUBLISHED_READ_SECRET_ACCESS_KEY --config wrangler.public.jsonc
```

Admin receives native writable bucket bindings. Never copy these credentials into frontend build variables, issue reports or MCP tool responses. Rotate credentials by replacing the Worker secrets and redeploying.

## 3. Deploy and stage the initial import

Run local type, security/integration and bundle checks first. Then deploy auth, admin and public, in that order:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec wrangler deploy --config wrangler.auth.jsonc
pnpm exec wrangler deploy --config wrangler.admin.jsonc
pnpm exec wrangler deploy --config wrangler.public.jsonc
```

The service initially has no published release; public health returning `not_published` is expected. Generate/import the source inventory with `pnpm ingest` and inspect its gaps and review-required material. In a local secret environment, set `KNOWLEDGE_EDITOR_ACCESS_TOKEN` to a client-issued OAuth editor token, then stage the corpus:

```sh
pnpm exec tsx scripts/upload.ts --editor-url https://EDITOR_HOST/mcp --corpus data/bootstrap-corpus.json
```

The uploader defaults to `data/bootstrap-corpus.json`, which includes approved source bodies and the complete source-gap registry. It sends exact corpus JSON to the protected `/mcp/imports` route (maximum 10 MiB) and prints a draft ID, revision, document/conflict counts and the review website URL. It never prints the token or imported content. This stages a shared private draft only; the generated corpus is not an approved public release. For smaller edits, use the editor MCP's import/draft tools directly.

Connect the editor to `ADMIN_ORIGIN/mcp`, sign in with the bootstrapped GitHub identity and prepare a release candidate. Open its authenticated `/review?candidate=…` URL, inspect the exact additions, source gaps, attribution and deletions, and approve there. No deployment command or import automatically grants publication approval.

Use `ADMIN_ORIGIN/review` to assign other numeric GitHub identities explicit editor, publisher or administrator roles. Keep a second society maintainer capable of access recovery. Removing a role must fail the next editor request even if its bearer token is still unexpired.

## 4. Prove deployed read-only isolation

Create a known, non-sensitive sentinel object in the **private** bucket using an authorised operator credential. For example, upload a tiny JSON file containing `{"purpose":"permission-sentinel"}` at `deployment-permission-sentinel.json`. Keep the bucket private and confirm the object exists through the operator account.

In a local secret environment, set `PUBLISHED_S3_ENDPOINT`, `PUBLISHED_BUCKET_NAME`, `PUBLISHED_READ_ACCESS_KEY_ID`, `PUBLISHED_READ_SECRET_ACCESS_KEY`, `PRIVATE_PROBE_BUCKET` and `PRIVATE_PROBE_KEY`. These must be the public Worker's actual read credentials; `PRIVATE_PROBE_KEY` identifies the known sentinel. Then run:

```sh
pnpm exec tsx scripts/storage-permissions.ts --confirm-denial-probe
```

This explicit probe reads the published active pointer, attempts a PUT and DELETE on a unique disposable `permission-probe/` key expecting 403, and HEADs the known private sentinel expecting 403. It prints only check names/statuses. A missing/404 private sentinel is insufficient evidence and fails. A credential which cannot read the published pointer also fails.

If the PUT unexpectedly succeeds, the probe attempts to delete that disposable object and always reports failure. If `cleanupNeeded` is true, remove objects under `permission-probe/` using an operator credential. If the probe fails due to a network interruption, inspect that prefix for an orphan before retrying. Narrow or replace the unsafe credential; do not launch with it.

These live checks complement unit tests and configuration inspection. They do not prove the scope of any different deployed credential or account.

## 5. Connect real clients and launch

Run the SDK doctor against the public endpoint and the authenticated editor endpoint. Complete the [ChatGPT/Claude acceptance record](connections.md), including a reviewed update, version-consistent retrieval, revocation and publication recovery. SDK success alone is insufficient.

Set the website's public build variables `KNOWLEDGE_PUBLIC_MCP_URL`, `KNOWLEDGE_EDITOR_MCP_URL` and `KNOWLEDGE_PUBLIC_API_URL`; the existing deployment/test workflows read repository variables with those names. Rebuild/preview Docusaurus and check `/connect/` on desktop/mobile. Use `PUBLIC_ORIGIN/mcp` for members and `ADMIN_ORIGIN/mcp` for maintainers. The OAuth origin is discovered automatically.

Add the website's exact origin to `ALLOWED_ORIGINS` for the public retrieval check/WebMCP adapter. If running the site under a preview hostname, allow that exact staging origin rather than a wildcard. The API's public data still requires no account; CORS is a browser boundary, not authentication.

After staging passes, provision separate production resources, repeat the permissions and client checks, and only then expose production URLs on the site. Record the deployed release, check date, owners and recovery contact without storing credentials or member transcripts. Configure aggregate alerts for service errors, authentication failures, import failures and incomplete publication attempts.

Apply both private database migrations. The authenticated `/operations` page shows seven-day hourly counters and incomplete publication receipts. The maintenance job prunes expired counters; no raw query, IP, credential or draft text enters these metrics. Check public `/health` and Cloudflare's aggregate Worker metrics separately. Configure alert thresholds and destinations in the society's Cloudflare account without enabling raw request logging.

For rollback or urgent withdrawal, use the authenticated review site's forms to prepare a candidate and review it before publication. Withdrawal removes the selected material from historical public releases too. It can target a document that an ordinary edit already removed from the current release. Existing text already copied into a member's chat cannot be recalled.

Withdrawal fails closed: after browser approval, deny markers are written **before** the new release becomes active. A storage failure or competing publication can therefore leave the selected records hidden even when the release activation fails. If that happens, open the authenticated review site's withdrawal form, enter the same document IDs (historical or already-denied IDs are accepted), prepare a fresh candidate and approve it to complete historical cleanup. Do not remove deny markers manually or restore withdrawn material through rollback.

An activated publication interrupted before its completion record or historical cleanup is recovered independently of the original approval's expiry. The admin Worker reconciles on privileged access and on its scheduled run. Recovery finishes already-activated operations; it does not activate an uncommitted candidate or grant access to a revoked maintainer. Check pending/conflict outcomes on the review page after a failed publication.
