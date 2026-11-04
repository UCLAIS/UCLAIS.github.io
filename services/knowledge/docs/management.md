# Committee management

The management service is a separate authenticated Worker at `https://manage.uclai.co.uk`. It edits GitHub source files through pull requests. The public website and MCP retain their existing deployment workflows. This service has no R2, D1, KV, model API, installation token or deployment credential.

## What it does

- Edit Markdown under `knowledge/faqs`, `guides`, `tutorials` and `nexus`.
- Add or replace PDF slide decks up to 8 MiB. Export PowerPoint or Google Slides to PDF before uploading. Selectable PDF text is required; image-only decks fail the knowledge checks.
- Show website publication, MCP health and release alignment, Luma feed freshness, slide build validation and bounded cover-image checks. Checks run on opening Overview or pressing Refresh. There is no unattended monitoring.
- Show pending management pull requests and recent website/knowledge workflow runs. Review and merge on GitHub using the repository's normal rules.

The pinned external archive remains maintained through its existing importer. Editing arbitrary website code, notebook uploads, learning-path administration, deleting material, merging pull requests and rerunning workflows are outside this first version.

## Access and credentials

The registered **GitHub App** is **UCL AI Society Management**, owned by **UCLAIS** and installed on **only `UCLAIS/UCLAIS.github.io`**. Its homepage is `https://manage.uclai.co.uk` and callback is `https://manage.uclai.co.uk/auth/callback`. Retain these repository permissions:

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

Keep the society's Cloudflare account on Workers Free. Deploy `wrangler.management.jsonc` only after configuring the GitHub App and secrets. The Worker has public `workers.dev` and preview URLs disabled, and its assets run through the Worker before delivery. A live exact-8-MiB upload succeeded on Free on 4 November 2026; this is an acceptance check, not a guarantee of throughput or spare CPU under load. Quota exhaustion may stop access. Do not enable paid resources to bypass a failed check.

DNS remains at IONOS, so do not assume a Workers Custom Domain can be attached directly without a Cloudflare zone. Use a **new, separate** Pages project named `uclai-management-gateway`, upload the generated gateway and bind **MANAGEMENT → uclai-management**. Configure its free-quota behaviour to **Fail closed**. Associate `manage.uclai.co.uk` in Pages first, then add only the `manage` CNAME pointing to the returned Pages hostname in IONOS. Preserve root, mail and MCP records. See [Pages subdomains with external DNS](https://developers.cloudflare.com/pages/configuration/custom-domains/).

The gateway forwards to management with the original request URL. The management Worker accepts only `MANAGEMENT_ORIGIN`; the `pages.dev` hostname cannot bypass that host check. Do not add the management binding to the existing public MCP gateway. Pages and Worker invocations share free quotas.

Before release, verify:

1. Certificate and host restriction, unauthenticated asset/API rejection, authorised sign-in, denied non-maintainer account, logout and GitHub access revocation.
2. A representative PDF and a maximum-size upload, including real Workers Free CPU/memory. If free limits fail, reduce the upload limit or redesign upload transfer before launch.
3. New and replacement deck pull requests, retained notes/downloads, source text search, safe viewer images and branch-protection checks.
4. Website and MCP publication of the same merged release, and unavailable/stale service states.

Local tests and dry runs alone do not establish the external configuration. Keep actual provider and browser evidence separate from fixtures.

See the [3 November security review](security-review-2026-11-03.md) for credential checks, the PDF sanitisation fix, dependency alerts and remaining acceptance checks.

### Deployment and acceptance, 4 November 2026

After explicit approval for the app, credentials and final installation/publication actions, the management Worker and gateway were deployed on the verified free-only account. The GitHub App ID is `5613474`, its public client ID is `Iv23ctU0nUHFpxvIAb1g`, and installation `178606665` is restricted to the website repository. User-to-server token expiry is enabled. Webhooks, device flow and callback wildcard matching are disabled.

`uclai-management` has the expected assets/rate-limit bindings and the two encrypted Worker secrets. Client/session secret values were transferred in memory and were not written to source, local credential files or diagnostic output. The temporary credential setup process was stopped after deployment. The gateway's production binding is **MANAGEMENT → uclai-management**, its quota behaviour is **Fail closed** (verified after reload), and Pages deployment `5ff3e477-ce54-4dc9-b2ed-0397757b2a7b` succeeded. IONOS serves CNAME `manage` → `uclai-management-gateway.pages.dev` with a 30-minute TTL. DNS and SSL are active; no further DNS change is indicated. The deployment token cannot access Pages, so its gateway was uploaded through the dashboard without broadening that token.

Twelve live boundary checks passed: the login page is available, anonymous private APIs reject access, private assets return the login screen, the Pages hostname is rejected, invalid OAuth state fails, and login starts with PKCE and a secure host-only cookie. Cloudflare rejects Python's stock HTTP User-Agent before the app with error 1010; the checks used a browser-compatible client without a cookie jar. No edge protection was disabled.

The first production callback exposed Workers-specific fetch differences that Node mocks missed. GitHub requests now detach the native fetch receiver, use supported `redirect: 'manual'` and reject redirects. OAuth form encoding and safe error categories are explicit. Public status calls use `global_fetch_strictly_public` and an honest status User-Agent, allowing this Worker to reach the separate public MCP through its normal edge protections. Do not replace these settings with an authentication bypass or forward GitHub credentials to redirected hosts.

Live browser acceptance passed as `@sometimesyash`:

- Authorisation and repeat sign-in, account display, editable library and current workflow reads.
- A Markdown proposal (#83), a 637-byte PDF proposal (#84), an exact 8,388,608-byte PDF proposal (#85) and a replacement proposal (#86). Downloaded Git blobs exactly matched both uploaded fixtures; paths and sidecars were correct. Replacement left the existing Markdown/notes and downloads unchanged. All four synthetic PRs were closed and their proposal branches deleted; none was merged or published.
- Sign-out returned the login screen and the same browser's private session API denied access. Sign-in succeeded again after the unused initial client secret ending `5395e977` was revoked. GitHub confirms only the working replacement remains.
- MCP and Luma report Healthy. Website and slide publication remain Unverified because the production website has not yet received the build-manifest support.

The actual Workers runtime fixture checks native OAuth/fetch, redirects and immediate denial of an existing session after its repository-write permission is revoked. The full service suite has 319 passing tests across 25 files. No real maintainer permission was removed and no second non-maintainer GitHub account was used: those are not claimed as live acceptance results. The local pinned runtime predates the production compatibility date; that limitation is documented in the fixture.

Source and publishing changes are in [PR #82](https://github.com/UCLAIS/UCLAIS.github.io/pull/82). Both CI checks passed at `1fe8286`; the protected branch still requires review. Merge the publishing support before expecting PDF content proposals to publish successfully on the website and MCP. A successful proposal is not a production publication. Management does not merge its own content proposals or invoke an administrator bypass.
