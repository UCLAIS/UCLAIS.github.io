# Committee management

The management service is a separate authenticated Worker in this repository. Its proposed address is `https://manage.uclai.co.uk`. It edits GitHub source files through pull requests. The public website and MCP retain their existing deployment workflows. This service has no R2, D1, KV, model API, installation token or deployment credential.

## What it does

- Edit Markdown under `knowledge/faqs`, `guides`, `tutorials` and `nexus`.
- Add or replace PDF slide decks up to 8 MiB. Export PowerPoint or Google Slides to PDF before uploading. Selectable PDF text is required; image-only decks fail the knowledge checks.
- Show website publication, MCP health and release alignment, Luma feed freshness, slide build validation and bounded cover-image checks. Checks run on opening Overview or pressing Refresh. There is no unattended monitoring.
- Show pending management pull requests and recent website/knowledge workflow runs. Review and merge on GitHub using the repository's normal rules.

The pinned external archive remains maintained through its existing importer. Editing arbitrary website code, notebook uploads, learning-path administration, deleting material, merging pull requests and rerunning workflows are outside this first version.

## Access and credentials

Create a **GitHub App**, owned by the society, and install it on **only `UCLAIS/UCLAIS.github.io`**. Set its homepage to `https://manage.uclai.co.uk` and callback to `https://manage.uclai.co.uk/auth/callback`. Request these repository permissions:

| Permission | Access | Purpose |
| --- | --- | --- |
| Contents | Read and write | Read material and create content branches |
| Pull requests | Read and write | Submit changes for review |
| Actions | Read | Report existing build/deployment runs |
| Metadata | Read | Verify the repository and user access |

Leave webhooks and device flow disabled. Enable expiring user access tokens. Users authorise the app through OAuth with S256 PKCE. The service uses each user's token, so GitHub constrains actions to both the app's permissions and the user's permissions. No app private key or installation token is needed. See [GitHub's user authorisation documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app).

Set `GITHUB_CLIENT_ID` and `MANAGEMENT_ORIGIN` in the management configuration. Set `GITHUB_CLIENT_SECRET` and `SESSION_SECRET` with Wrangler's secret input or the Cloudflare dashboard, never a committed file or public website variable. Generate `SESSION_SECRET` from at least 32 cryptographically random bytes, encoded as base64. The code requires at least 43 characters. Optional `ALLOWED_GITHUB_IDS` further restricts access to comma-separated stable numeric IDs; it does not replace the repository-write requirement.

All management assets and APIs check the user's current repository write access. The session lasts at most one hour and is an encrypted, authenticated, host-only Secure/HttpOnly cookie. JavaScript receives only a CSRF nonce, never the GitHub token. Writes also require the exact management Origin. Sessions have no server-side store: signing out clears the browser cookie, and a copied cookie remains usable until its expiry or GitHub access revocation. Rotating `SESSION_SECRET` invalidates all sessions. Do not add a production authentication bypass for previews.

## Publication and PDF processing

Every save uses a fixed base commit. A changed `main` causes a conflict instead of silently overwriting newer work. Successful submissions create unique `committee/*` branches and pull requests. If GitHub saves a branch but does not confirm a pull request, the error names the branch for recovery; do not blindly resubmit.

New decks produce a canonical Markdown file, a `.meta.json` sidecar and a PDF under `knowledge-assets/slides/<canonical-path-without-extension>/source.pdf`. The sidecar's `slides` field must match that exact path. Replacing a deck preserves the canonical file, metadata and existing additional downloads. **Written notes remain independently maintained and must be reviewed for consistency with the replacement PDF.**

The knowledge importer includes the PDF's extracted text with explicit slide/page locators. The website build uses the existing bounded PDF parser, sanitising slide preparation and Poppler renderer to create a download and raster images under ignored `static/materials/_generated/`. The downloadable copy rebuilds ordinary HTTPS links, drops internal destinations and page actions, and refuses chained actions and interactive annotations. Generated decks go into the site build, not a second content database. Original uploads are outside the website's static directory. Existing decks without a `slides` sidecar retain their existing viewers. Draft or withdrawn documents do not produce generated viewers.

**The source repository is public.** PDFs, Markdown, sidecars and branches are visible in GitHub as soon as submitted, even before review or publication on the society site. Both forms explicitly require acknowledgement. Do not upload confidential drafts, student records or material without publication permission. Git history can retain replaced material.

The website writes `knowledge-status.json` after a successful build, recording its source commit, knowledge release and validated deck assets. The dashboard compares that release to the live MCP. A passing historical workflow does not establish that the newest update is live. An endpoint health check is not a real ChatGPT/Claude client acceptance test. Slide checks sample one cover per deck, capped at eight; they do not claim to fetch every slide.

## Build and hosting

From `services/knowledge`, run:

```sh
pnpm typecheck
pnpm test
pnpm management:build
pnpm management:gateway
```

`management:build` bundles without deploying. `management:gateway` prepares a separate Pages advanced-mode gateway under `.generated/management-gateway/`. The knowledge CI workflow runs both without secrets. No workflow automatically deploys management.

Keep the society's Cloudflare account on Workers Free. Deploy `wrangler.management.jsonc` only after configuring the GitHub App and secrets. The Worker has public `workers.dev` and preview URLs disabled, and its assets run through the Worker before delivery. A custom domain and free-plan upload CPU/memory/latency acceptance still require live verification. The 8 MiB upload limit bounds memory; it does not prove that maximum uploads fit Workers Free CPU. Quota exhaustion may stop access. Do not enable paid resources to bypass a failed check.

DNS remains at IONOS, so do not assume a Workers Custom Domain can be attached directly without a Cloudflare zone. Use a **new, separate** Pages project named `uclai-management-gateway`, upload the generated gateway and bind **MANAGEMENT → uclai-management**. Configure its free-quota behaviour to **Fail closed**. Associate `manage.uclai.co.uk` in Pages first, then add only the `manage` CNAME pointing to the returned Pages hostname in IONOS. Preserve root, mail and MCP records. See [Pages subdomains with external DNS](https://developers.cloudflare.com/pages/configuration/custom-domains/).

The gateway forwards to management with the original request URL. The management Worker accepts only `MANAGEMENT_ORIGIN`; the `pages.dev` hostname cannot bypass that host check. Do not add the management binding to the existing public MCP gateway. Pages and Worker invocations share free quotas.

Before release, verify:

1. Certificate and host restriction, unauthenticated asset/API rejection, authorised sign-in, denied non-maintainer account, logout and GitHub access revocation.
2. A representative PDF and a maximum-size upload, including real Workers Free CPU/memory. If free limits fail, reduce the upload limit or redesign upload transfer before launch.
3. New and replacement deck pull requests, retained notes/downloads, source text search, safe viewer images and branch-protection checks.
4. Website and MCP publication of the same merged release, and unavailable/stale service states.

Local tests and dry runs do not establish that the GitHub App, DNS or Cloudflare deployment has been configured.

See the [3 November security review](security-review-2026-11-03.md) for credential checks, the PDF sanitisation fix, dependency alerts and remaining acceptance checks.

### Hosting setup checked on 3 November 2026

The society account passed the existing free-only subscription check. The Pages project `uclai-management-gateway` has been created, and Cloudflare confirmed its hostname as `uclai-management-gateway.pages.dev`. The custom domain `manage.uclai.co.uk` is registered against that project and is awaiting DNS verification.

In IONOS, add **CNAME `manage` → `uclai-management-gateway.pages.dev`**, with a one-hour TTL. No scheme or path belongs in the target. After saving, check the public DNS record and Cloudflare certificate/domain status. The latest check against two authoritative IONOS servers returned **A `217.160.0.122`** for `manage` and no CNAME. Replace that subdomain's A record with the CNAME; preserve the other DNS records.

No successful initial gateway deployment has been confirmed. The management Worker, service binding, GitHub App and login secrets still need configuring and live acceptance. The existing deployment token can verify account subscriptions but returns 403 for Pages project access; it must not be replaced with a Global API Key.
