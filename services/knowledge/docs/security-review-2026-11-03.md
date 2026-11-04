# Pre-deployment security review, 3 November 2026

## Outcome and scope

No exposed credentials were found in the checked source, reachable Git history, generated artefacts or sampled live website assets. One confirmed active-content defect in slide PDF sanitisation was reproduced and fixed locally. No additional high-confidence authentication bypass, arbitrary repository write, XSS, CSRF or SSRF was found in the management and public MCP paths reviewed.

The management service was subsequently deployed and live-tested on 4 November, as recorded in the addendum below. The older website lockfile has unresolved dependency advisories, and production publishing support remains in a review-required PR. This review is evidence about the checked paths, not a guarantee that every dependency or possible input is safe. Earlier checkpoints below are historical.

Reviewed management commit: `039c31e5787f35b3882cfd27596571f709a6fcfe`, plus the local sanitisation fix and tests. Public MCP baseline: `634b5048b6deefe573f4f863016a5998cd4da95a`. Scope included management authentication, GitHub writes, UI, status checks, PDF ingestion/publication, public MCP routing, deployment configuration and CI workflows. Legacy R2/admin/auth services are not part of the launch configuration.

## Credential checks

- Gitleaks 8.30.1, obtained from its official release with its archive checksum verified: no candidates in 452 tracked source files, the final 454-file source snapshot including the fix/tests/report, or all reachable history. The history scan included merge diffs and processed 265 diff-bearing commits, approximately 58.9 MB. The repository has 272 reachable commits and is not shallow.
- Exact comparison against the one real local credential currently configured: no matches in 4,804 reachable Git blobs or 470 checked artefact files. Credential values were never included in reports or terminal output.
- Gitleaks: no candidates in the generated knowledge/gateway payloads or a fresh management Worker dry-run bundle.
- Live website: no candidates in the homepage, connection page, tutorial index and their four linked JavaScript/stylesheets, approximately 580 kB in total. This sampled loaded assets; it was not a crawl of every public URL.
- Three existing tracked PDFs: extracted text had no credential candidates; inspection found no active-content flags. Image-only content was not OCR-scanned for credentials.
- Local `.env` files remain ignored. Only blank configuration examples are tracked.

GitHub reported repository secret scanning and push protection disabled. Both were enabled on this public repository and independently read back as enabled. The alerts API then returned an empty list; completion of GitHub's initial historical rescan was not established. Public repository secret scanning is free according to [GitHub's documentation](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning). No paid security product was enabled.

These checks do not establish that credentials were never exposed in provider logs, deleted remote refs, inaccessible copies, images or undetected formats. No evidence found here requires a credential rotation. Repository uploads are public immediately, including PDF originals; pattern scanners and push protection cannot guarantee that an uploaded PDF contains no secrets.

## Confirmed finding, fixed locally

**Medium: downloadable slide PDFs could retain active actions.** An authorised contributor could submit a PDF whose otherwise permitted HTTPS link action included a `/Next` JavaScript action. Page `/PresSteps` navigation actions also survived the old copy process. Publication required the content branch to be reviewed and merged; execution further depended on the reader's PDF action policy. The raster slide viewer does not execute PDF actions.

A synthetic fixture using harmless `void(0)` action text reproduced both retained structures without executing the JavaScript. No such structures were found in the existing tracked PDFs.

`scripts/prepare-slides.py` now reconstructs link annotations from a narrow set of fields, permits credential-free HTTPS URLs only, rejects chained actions and interactive annotations, drops internal destinations and page action/attachment fields, and sanitises every page before copying any page into the output document. The original uploaded PDF remains in public GitHub history by design; the sanitised copy is the website download.

`scripts/test_prepare_slides.py` exercises the actual preparation and output PDF. Regression cases cover dictionary and array action chains, page actions, discarded auxiliary annotation actions, and retained ordinary links/text. Both website deployment workflows run these tests before publishing.

## Dependencies requiring maintenance

The management/knowledge service's frozen pnpm dependency audit returned **zero advisories** on this date. That does not cover the independent website dependency tree.

The website uses Docusaurus 2.4.3 and its existing `yarn.lock`. Matching its exact locked versions against npm's bulk security advisory API found **54 affected packages, 163 distinct advisory URLs and 175 package/advisory matches**, including four classified critical by the advisory feed. These are dependency matches, not 175 demonstrated exploits in this application. They were not silently dismissed or fixed by an untested major framework migration.

| Critical match | Reachability assessment |
| --- | --- |
| `@babel/traverse` 7.22.8, [GHSA-67hx-6x53-jw92](https://github.com/advisories/GHSA-67hx-6x53-jw92) | Relevant to compiling malicious JavaScript with affected Babel plugins. The management forms cannot write application code or MDX; imported knowledge is parsed as inert data. Developer-authored website code still uses this old build dependency. |
| `proxy-addr` 2.0.7, [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | Requires a server with the described trusted-proxy subnet configuration. This belongs to the website's Express tooling. Express is not a deployed GitHub Pages or management Worker backend. |
| `shell-quote` 1.8.1, [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p) | Requires attacker-controlled object operator tokens passed to `quote()` and then a shell. Located callers in editor tooling use `parse()` for configured editor strings. No such management request-to-shell flow was found. |
| `websocket-driver` 0.7.4, [GHSA-xv26-6w52-cph6](https://github.com/advisories/GHSA-xv26-6w52-cph6) | Used by the development server's SockJS/Faye stack. Neither static GitHub Pages nor the management Worker deploys this server. |

Other matches include old parsers, bundlers, network helpers, KaTeX and PrismJS. Imported management Markdown is not run through MDX/Babel, raw HTML or a trusted KaTeX pipeline; it becomes explicit React elements with checked links. This reduces reachability through the new forms, but it does not close the dependency backlog. Remaining advisory matches were not individually reproduced. Plan a separate website dependency update and verify its output before calling the whole website toolchain clean. Keep development servers local while that work is outstanding.

## Boundaries checked and validation

- Private assets and APIs require a valid encrypted host-only session and a fresh GitHub repository-write permission check. Purpose-separated authenticated encryption, OAuth PKCE/state, session expiry, CSRF and exact Origin checks were reviewed and exercised by local tests.
- GitHub calls use a fixed repository. Content paths cannot target workflows, hidden files or arbitrary application code. Writes create unique proposal branches and pull requests; they do not push to or merge `main`. Stale bases are rejected.
- Live GitHub classic protection on `main` requires one approving review, dismisses stale reviews and requires the strict `Knowledge security and integration` status check. Enforcement for administrators is disabled, so administrators remain able to bypass that review boundary. Repository rulesets add no further branch rules.
- Public MCP configuration has no management service binding or content/deployment credential. Its gateway restricts paths, body size and forwarded headers; public tools remain read-only.
- Status checks use fixed public hosts and a bounded, same-origin slide sample. Management rendering uses text values rather than inserting response HTML.
- Passed after the fix: 311 service tests across 24 files, TypeScript checking, seven PDF extraction/security tests, two public-PDF regression tests, seven website component/plugin tests and the isolated production website/MCP publication integration build. The management bundle was a dry run, not a deployment.

## Remaining launch checks

1. Configure the GitHub App and Worker secrets, then verify real authorised and rejected sign-ins, exact host enforcement, private asset rejection, logout and access revocation. Local mocked tests do not establish the external configuration.
2. Verify representative and maximum-size PDF submissions on Workers Free, including CPU/memory limits, and keep quota handling fail closed.
3. Submit and review a content proposal, then verify both website and MCP publication of the same approved release. Existing CI checks have been run locally; no audit changes have been deployed.
4. Complete the management Worker, service binding and gateway deployment. The user corrected IONOS after the initial audit: two authoritative servers and public resolvers confirm CNAME `manage` → `uclai-management-gateway.pages.dev` (TTL 1,800 seconds). HTTPS verification failed on 3 November but passes on 4 November. Cloudflare confirms the custom domain is active with SSL enabled; the undeployed infrastructure and remaining HTTP 522 are recorded below.

Local scan details and redacted machine reports are in `/private/tmp/uclai-security-review-20261103/`. They contain no intentionally recorded credential values and are temporary audit evidence, not deployment inputs.

## Verification rerun, 4 November 2026

Rechecked commit `2f69b5d` with the local DNS/runbook updates. No code changes or deployments were made during this rerun.

- Credential scans of the 454-file source snapshot, all reachable history, regenerated knowledge/gateway artefacts, the fresh management bundle and sampled live website text assets returned no candidates. Exact comparison against the locally configured credential found no matches in 4,811 reachable Git blobs or 470 checked artefact files.
- GitHub secret scanning and push protection remain enabled. The secret alerts API returned no alerts.
- The refreshed management/knowledge dependency audit has zero advisories. The unchanged website lockfile still has 54 affected packages: the current registry response contains 162 distinct advisory URLs and 174 package/advisory matches, including four critical matches. The difference from the previous count reflects advisory metadata, not a dependency fix.
- Passed: all 311 service tests, TypeScript checking, two slide PDF regression tests, seven extraction/security tests, seven website plugin tests, the isolated production publication integration build, and public/management Worker dry-run bundles. The first website trial selected system Python without pypdf; rerunning with the existing bundled PDF runtime passed. No production setting was changed to bypass a failed check.
- DNS correctly resolves `manage` to `uclai-management-gateway.pages.dev`. HTTPS passes certificate verification, but the management hostname and Pages hostname both return HTTP 522. The public MCP health endpoint still reports `ready`. After the user signed in again, Cloudflare confirmed the domain is Active / SSL enabled, the gateway has no deployments or service binding, and the complete application inventory has no management Worker. This is incomplete application setup, rather than a DNS propagation issue.
- After explicit user approval, the gateway's production quota behaviour was saved as Fail closed and verified after reloading the dashboard. This is a persistent availability setting: exhaustion of the free Pages Functions quota will show an error rather than continue serving static assets. No application deployment was performed.

Fresh temporary evidence is in `/private/tmp/uclai-security-review-20261104/`, with service/build logs in `/private/tmp/uclai-*-recheck-20261104.*`. The previous website advisory backlog and real GitHub/Workers Free acceptance checks remain outstanding. Management is not cleared for launch.

## Initial management deployment, 4 November 2026

The user subsequently approved building/deploying the society-owned app, its repository-only installation, encrypted Worker credentials, the separate Pages service binding and gateway publication. The new Worker is deployed, the Pages deployment succeeded, and `https://manage.uclai.co.uk/` serves the GitHub login page. Both CI jobs on [PR #82](https://github.com/UCLAIS/UCLAIS.github.io/pull/82) passed at `4b85a61`; the publishing changes still require protected-branch review.

The installed app is owned by UCLAIS and restricted to UCLAIS/UCLAIS.github.io, with Contents/Pull requests write and Actions/Metadata read only. Token expiry is enabled; webhooks, device flow and wildcard callbacks are disabled. No app private key, installation token, deployment token, storage service or paid feature was added to the management runtime. Client/session credentials were handled in memory and stored as encrypted Cloudflare Worker secrets, with no credential values in source or diagnostic output.

Twelve anonymous live checks passed, including API denial, gated assets, rejection of the Pages hostname, invalid OAuth state, PKCE and Secure/HttpOnly host-only login cookie attributes. The Python default User-Agent was rejected by Cloudflare's edge (1010); the same app checks passed with a browser-compatible, cookie-free client. Edge protections were retained.

Authorised sign-in awaits the user's GitHub Authorize action. Live dashboard/upload tests, maximum-file CPU acceptance, logout and real GitHub permission revocation are therefore still pending. Revocation of the unused initial client secret is approved but deferred until the replacement is verified. The inherited website dependency advisories remain open; successful deployment of this separately audited Worker does not clear that backlog.

## Live acceptance and runtime corrections, 4 November 2026

Real authorised sign-in succeeded as `@sometimesyash`. This found two production-only compatibility defects that mocked Node tests had missed: Workers rejects `redirect: 'error'`, and a stored native fetch function must be called without binding the GitHub client as its receiver. The fixes use detached fetch, supported manual redirects and explicit rejection of non-success responses. OAuth failures have safe, specific categories without returning provider bodies or credentials.

A new native Miniflare/workerd fixture runs production authentication, cookie crypto, GitHub requests and status handling. It proves sign-in, private API/assets, four service checks, redirect rejection without credential forwarding, and immediate denial of an existing session after fixture repository-write permission is revoked. The full suite passed 319 tests across 25 files plus TypeScript. The pinned local runtime uses an earlier supported compatibility date than production; it does not simulate every production setting.

MCP/Luma status initially failed because they are separately deployed Workers behind the same zone. `global_fetch_strictly_public` now routes their public-only checks through the edge, and a declared status User-Agent avoids the stock-client edge rejection. The browser now reports both services Healthy. Website/slides remain Unverified until PR #82 publishes their manifest. No edge security protection was disabled and no management credential was added to the public service.

Live content acceptance created synthetic PRs #83 (Markdown), #84 (637-byte PDF), #85 (exact 8 MiB PDF) and #86 (replacement PDF). Both uploaded blobs exactly matched their local fixture bytes, and the replacement retained the existing Markdown/notes and additional downloads. The 8 MiB request completed successfully on the verified free-only account without enabling paid resources. This checks a maximum-size request, not sustained load or guaranteed CPU headroom. All four test PRs were closed and their proposal branches deleted without merging.

Live logout cleared access: the browser returned to the login screen and its private session API required sign-in. After verifying the replacement credential, the approved unused original client secret ending `5395e977` was revoked. GitHub shows one remaining, used client secret. A fresh sign-in then succeeded. No credential values were printed or added to source.

No real repository member was removed and no second non-maintainer account was used. Live role revocation and non-maintainer OAuth denial therefore remain unverified externally, although denial is covered by native runtime and unit fixtures. Source/publishing changes are in review-required PR #82; current production main remains `634b504`. The publishing integration build passed locally, but end-to-end publication of a new merged PDF has not occurred. The inherited website advisory backlog remains open.
