# Management security review, 5 November 2026

## Outcome and scope

**No high-confidence exploitable vulnerabilities identified in the reviewed management paths.** A minor upload-size validation edge case was corrected: the previous base64-length calculation admitted a PDF one byte over 8 MiB. The server now checks the decoded byte count; exact-limit and one-byte-over requests are regression-tested.

Reviewed runtime source: `bdcdb2f`, including the organisation gate, generated slide paths and GitHub-backed approvals. Deployed management Worker version: `8e035c84-5cdc-4a1d-8dc9-3a3c8068221e`. This is a focused code/configuration review and acceptance check, not proof that no vulnerability can exist. The independent website dependency backlog remains open.

## Access, sessions and request boundaries

- Every private asset/API checks the user's current active UCLAIS membership (stable organisation ID), repository write permission and any configured account allowlist. Missing/pending membership, outside collaborators, revoked write access and unverifiable provider responses fail closed. No individual allowlist is configured for the organisation-wide policy.
- OAuth uses PKCE/S256 and encrypted, expiring state. Session cookies are purpose-separated AES-GCM values with random nonces, Secure/HttpOnly/SameSite=Lax and a host-only prefix, with an absolute lifetime of at most one hour. Tampering, duplicate cookies, wrong-purpose values and expiry are checked.
- Mutations require the exact management Origin, a session-bound CSRF header and JSON. Forged Bearer headers, lookalike origins, missing CSRF and wrong content types are refused before repository work. Request bodies are bounded while streaming.
- GitHub requests use fixed HTTPS API/repository destinations and refuse redirects. Public status checks use fixed public hosts and bounded same-origin image samples. Error responses omit provider bodies and credentials. UI and diff rendering use text values rather than HTML insertion.

## Upload and approval boundaries

New slide paths are generated server-side from allowlisted collections and bounded, normalised metadata. User-supplied arbitrary paths cannot select new write destinations. Collisions with existing Markdown, metadata or PDF assets are refused; replacements retain their existing paths and written material. Writes create proposal branches and PRs, never direct changes to `main`.

PDF uploads have an exact 8 MiB API limit. Publication uses the existing bounded text extractor, sanitised downloads and raster viewers. The real 22-page Multivariate Regression upload passes the complete publication build after fixing the isolated checker to include uploaded PDF sources. No active annotations were found in that deck. Its failed check was an omitted-input test-workspace bug, not evidence of an unsafe PDF.

Approvals use the signed-in reviewer's user token and the existing Pull requests write permission. The server re-fetches the PR, requires an open non-draft `committee/*` branch in the fixed repository targeting `main`, checks the complete changed-file list (at most 100 files), refuses self-approval and rejects a head commit changed since the review opened. It submits only `APPROVE` for the reviewed `commit_id`; client-supplied repository, reviewer or action overrides cannot alter that. Preview text is bounded and escaped; omitted/binary changes link to GitHub for review. Explicit review confirmation is required. The app cannot merge, override reviews or change branch rules. GitHub determines whether the recorded approval satisfies its rules, including stale-review handling.

## Provider configuration and credential checks

- GitHub installation `178606665` was rechecked: only `UCLAIS/UCLAIS.github.io` is selected. Permissions are Contents/Pull requests write and Actions/Members/Metadata read. No additional permission or credential was added for approvals.
- Cloudflare's production gateway was rechecked: `MANAGEMENT` binds only to `uclai-management`, and quota handling remains **Fail closed**. Deployment verified the free-only account and retained the existing encrypted secret names. Runtime bindings have no deployment credential or storage service.
- Gitleaks found no candidates in the final tracked source snapshot, Worker bundle, reachable history or extracted text from the submitted PDF. The known local configured secret value had no exact matches in 4,852 reachable Git blobs or 471 checked artefact files. Secret values were not printed in these checks.
- GitHub secret scanning and push protection are enabled; the alerts API returned zero alerts. The management/knowledge service's full dependency audit returned zero advisories on 5 November. The separate website lockfile was not upgraded or cleared by this review; see the [earlier dependency assessment](security-review-2026-11-03.md).

## Verification and practical limits

All **373 service tests across 26 files**, TypeScript and the management Worker build passed. Native workerd tests cover OAuth, private data, review loading, provider redirects and existing-session denial after fixture membership/write revocation. Handler tests cover approval identity, self-approval, stale commits, repository/branch scope, missing confirmation, request limits, CSRF/Origin and forged authority fields.

**16 live anonymous boundary checks passed**, including private review/approval denial, forged cookies, cross-origin preflight, host restriction and OAuth state/PKCE/cookie checks. Real member sign-in worked and all four dashboard service checks reported Healthy. A live PDF submission without a path produced the expected three generated files in synthetic PR #90; it was closed and its branch deleted without publishing. The live review screen loaded all four files of the real PR #89 and disabled approval for its author.

A second real reviewer has not submitted an approval through this GUI, and no real member was removed for a revocation test. Those success/denial cases are transport/handler/native-runtime fixtures, not claims of external account acceptance. The local pinned workerd also uses an earlier supported compatibility date than production, as documented in the fixture.

Uploads and branches are public on GitHub immediately, before merge; form acknowledgement does not scan every future document for confidential material. Scans cannot exclude exposure in inaccessible copies, images or undetected formats. Stateless logout clears the browser cookie but cannot revoke a stolen copy before expiry; repository/membership/token revocation or rotating the session secret blocks its continued use. These are explicit operating limits, not a claim of unrestricted safety.
