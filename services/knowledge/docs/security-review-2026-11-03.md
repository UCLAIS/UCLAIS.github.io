# Pre-deployment security review, 3 November 2026

## Outcome and scope

No exposed credentials were found in the checked source, reachable Git history, generated artefacts or sampled live website assets. One confirmed active-content defect in slide PDF sanitisation was reproduced and fixed locally. No additional high-confidence authentication bypass, arbitrary repository write, XSS, CSRF or SSRF was found in the management and public MCP paths reviewed.

Deployment remains paused. The older website lockfile has unresolved dependency advisories, and the new management service still requires real GitHub App and hosting acceptance. This review is evidence about the checked paths, not a guarantee that every dependency or possible input is safe.

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
4. Correct IONOS `manage`: authoritative DNS currently returns A `217.160.0.122`, rather than CNAME `uclai-management-gateway.pages.dev`. Verify the certificate and domain after correcting that record.

Local scan details and redacted machine reports are in `/private/tmp/uclai-security-review-20261103/`. They contain no intentionally recorded credential values and are temporary audit evidence, not deployment inputs.
