# Knowledge service security

The service separates public retrieval, OAuth identity and privileged editing. None of the checked-in configurations contains deployed resource IDs or credentials. Replace `.invalid` origins and resource identifiers, apply the private database migration, and provision secrets before staging deployment.

## Trust boundaries

The public Worker receives only a bucket-scoped R2 **Object Read only** S3 credential for the published bucket. It has no D1, private R2, OAuth service binding or publication credentials. Its read APIs cannot invoke the administrative Worker. A TypeScript read-only interface or omitted public tool is additional structure, not the storage permission boundary.

The auth Worker handles GitHub OAuth, explicit per-client MCP consent and the Workers OAuth Provider's issuance/validation endpoints. GitHub identity uses the verified numeric account ID, not mutable usernames or email addresses. The GitHub access token is discarded after identity lookup; the server requests no repository/email permissions. OAuth access tokens have a 15-minute lifetime and audience `ADMIN_ORIGIN/mcp`. The configured refresh lifetime is seven days. The provider rotates refresh tokens and retains **one previous refresh token** to tolerate concurrent use; immediate single-use replay rejection is not claimed. A token outside that overlap is rejected. Removing a maintainer denies privileged requests through live D1 checks even before their access token expires.

The admin Worker and its authenticated review pages form one privileged trust domain. It can write shared drafts and published snapshots. The public-facing editor endpoint exposes no publication, rollback, withdrawal or role-management tool. Editor OAuth tokens cannot authenticate review endpoints. Publication requires a separate host-only browser session, current publisher/admin role, same-origin form POST, CSRF token and candidate-bound approval. Shared drafts are visible to all approved maintainers.

The review page establishes a deliberate review step. It does not prove a human pressed the button: a browser agent operating an authorised session can use the page. A third isolated publisher deployment would reduce the consequence of arbitrary code execution in the admin Worker, but is outside this beta's trust boundary.

## Content and publication

Imports stage private drafts; they do not fetch arbitrary URLs or activate releases. Local ingestion controls allowed source repositories and URL fetching. Runtime `POST /mcp/imports` accepts validated Corpus JSON, checks the same editor OAuth scope/live role and returns draft/conflict metadata. Imports preserve curated corrections and report conflicts. Content marked `review-required` is excluded from the publication candidate until a maintainer approves its source status.

Tutorial code, notebooks, MDX and imported text remain inert data. The review page displays escaped text without scripts, iframe embeds or external images, under a restrictive Content Security Policy. Source text cannot change tool definitions, role assignments or release state. Prompt-injection evaluations cannot guarantee the behaviour of every external member's assistant; server-side permissions remain authoritative.

Imported text is redacted for recognisable credential formats, and corpus validation rejects remaining credential-like strings without echoing them in diagnostics. Repository checks prove that real environment files, private imports and local state are ignored, while blank templates and the approved bootstrap remain eligible for version control. These pattern checks supplement content review; they do not prove all possible sensitive data is absent. Public upstream repositories can contain exposed credentials too.

The public service also retrieves the single approved Luma calendar subscription, with no API key or arbitrary URL input. Redirects, oversized decoded bodies, unsafe dates and unsupported recurrence are refused or reported. It reads selected public event fields only and ignores attendee/account records, attachments and alarms. Cached calendar snapshots expire after 12 hours, matching the feed's advertised interval; a failed refresh never makes expired events appear current. Calendar updates are controlled on Luma, outside the draft-release workflow, and carry a separate source version. Reviewed withdrawal deny markers also apply to live event IDs.

Candidates are immutable, hashed snapshots bound to their base release. The review page verifies the hash and current draft revision. Publication verifies the approved hash/base again, writes immutable release objects and atomically swaps the active pointer using an R2 conditional write. Another publication makes an old base fail. Publication receipts bind the operation ID to its actor and candidate; retries reconcile committed work rather than creating another release. R2 and D1 are not one transaction, so crash recovery is covered explicitly by release tests. Authenticated requests and a 15-minute maintenance job reconcile releases whose activation already committed and complete pending withdrawal cleanup. Maintenance never activates an uncommitted publication attempt.

Withdrawal is a reviewed publication operation. It creates a new release, marks withdrawn document IDs and removes historical snapshots containing the material. It cannot erase answers already retained in external assistants or downloads. Rollback cannot restore withdrawn material.

## Operational controls

The migration bootstraps numeric GitHub ID `57414242` as administrator. Add a second administrator through the review page before handover; the final administrator cannot be removed. All other accounts require explicit approval. Never add a shared API-key fallback or production authentication bypass.

Auth/admin requests are bounded and rate-limited through the private database, with hashed rate-limit keys. All editor scopes and live roles are enforced server-side; role claims submitted in tool input are ignored. Internal exceptions become generic client errors. No application code logs bearer tokens, OAuth codes, GitHub access tokens or raw draft bodies. Review responses use `no-store` and `no-referrer`. Infrastructure-level logging and retention must be checked separately when provisioning the Cloudflare account.

Operational metrics contain only UTC hourly counts for two fixed services and six fixed outcomes. They contain no user IDs, IPs, URLs, query text, credentials or draft bodies. The authenticated browser `/operations` page exposes these counters and pending publication recovery status. Retention keeps the current hour and 167 previous hourly buckets; scheduled maintenance prunes older counters. Metric failures are caught by the calling service and do not block an action.

Public service health is available at `/health`; use Cloudflare's aggregate Worker metrics for public error/rate-limit alerts. Alerts and delivery destinations require account configuration during staging.

The auth Worker needs `global_fetch_strictly_public` to allow safe Client ID Metadata Document fetching. Dynamic client registration remains enabled for older supported clients. Registration permits identifying a client; it never adds a person to the maintainer allowlist.

## Verification

`tests/auth-security.test.ts` runs the actual OAuth provider, Workers runtime, KV, D1 and cross-Worker Service Binding. Only outbound GitHub responses are replaced by a separate test Worker. It checks discovery, consent binding, escaping, PKCE, redirect substitution, unknown identities, code replay, audience, token expiry/tampering, refresh rotation and browser-ticket binding.

`tests/admin-security.test.ts` exercises anonymous requests, Origin handling, cookie/bearer separation, private bulk import, inert previews, CSRF/session substitution, changed drafts, publication retries, live revocation, editor permissions, last-admin protection, error redaction and request-size/schema limits. Release/storage/ingestion tests cover atomic activation, recovery, source fetching and the public deployment's binding policy. A staging check with the actual Cloudflare read-only credential must additionally confirm that PUT/DELETE and private-bucket access fail before public launch.

`tests/admin-store-security.test.ts` runs receipt identity, state monotonicity and recovery-history checks in real D1. `tests/metrics.test.ts` verifies atomic counts, fixed dimensions, absence of sensitive fields and retention in real D1; the admin runtime suite also checks that `/operations` requires browser authentication.

Run `pnpm --dir services/knowledge test` and `pnpm --dir services/knowledge typecheck`. Workerd tests require localhost ports. No automated test here signs into a real GitHub account or proves the production OAuth application's settings, callback URLs, DNS or client compatibility. Those require the final staging connection exercise in ChatGPT and Claude.
