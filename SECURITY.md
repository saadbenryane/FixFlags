---
status: canonical
authority: operations
reviewed_at: 2026-10-09
supersedes: []
---

# Security

Controlled automatic-account proof may run on an explicitly configured HTTPS origin only in the isolated Railway `public-validation` environment. This uses normal run admission, credentials, worker execution, and signed receiving webhooks while `ACCOUNT_CHECKS_LIFECYCLE_VERIFIED` remains false. Every routine admission and privileged operation rechecks the Site's origin. Production cannot use this proof mode and remains gated on completed lifecycle evidence. Cleanup of existing identities remains independently available with usable stored credentials.

*Assets, trust boundaries, invariants, and dangerous operations.*

## Assets

| Asset | Location / type | Sensitivity |
|-------|----------------|-------------|
| Database credentials | `DATABASE_URL` env | Critical |
| Redis credentials | `REDIS_URL` env | Critical |
| AI API keys | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | Critical |
| Auth secret | `BETTER_AUTH_SECRET` | Critical |
| Stripe secret key | `STRIPE_SECRET_KEY` | Critical |
| Stripe webhook secret | `STRIPE_WEBHOOK_SECRET` | Critical |
| GitHub tokens | `GithubConnection.encryptedToken` (DB) | High (access user repos) |
| R2 credentials | `R2_*` env vars | High |
| Email API key | `RESEND_API_KEY` | Medium |
| Cron auth | `CRON_SECRET` | Medium |
| User data | `User` table (email, name) | Medium |
| Audit data | `Audit`, `AuditPage`, `Flag` tables | Low-Medium (URLs, page content) |

## Trust boundaries

1. **Request proxy ↔ Application:** Next.js 16 runs `proxy.ts` on its Node runtime. Keep this entrypoint dependency-free, without Prisma, authentication services or provider clients. It checks cookie presence (not validity) for UX gating. Server validates session on every protected route.
2. **Client ↔ Server:** All API routes validate authentication server-side. Cookie-based session. CSRF protection via same-site cookies.
3. **Worker ↔ Queue:** BullMQ uses Redis. No additional auth on local Redis. Production Redis should require `AUTH`.
4. **External ↔ Application:** Stripe webhooks via signature verification. Cron endpoints via `CRON_SECRET` bearer token. MCP via API key (hashed, prefixed `ff_live_`).
5. **GitHub API:** Tokens are encrypted at rest. Website beta supports owner-authorized GitHub connection and revocation. Repository execution remains parked.
6. **Public destinations:** Shared HTTP fetching and the managed Chromium proxy validate the addresses passed to socket connections and reject private/reserved networks. URL and redirect admission guards remain in place. HTML fetching also requires HTML and bounds response size.

HTTP sockets use the shared public DNS lookup through the installed Undici
dispatcher, preserving the URL hostname for Host and TLS identity. A public
preflight answer cannot authorize a different private address at connection time.
Managed Chromium uses a loopback proxy for HTTP, TLS tunnels and WebSockets,
including network owned by workers and embedded renderers. TLS stays between
Chromium and the destination. QUIC and non-proxied WebRTC UDP are disabled.
Browser disconnection closes the proxy and its sockets. The existing explicit
localhost fixture option bypasses only literal localhost and 127.0.0.1 hosts;
lookalike hostnames and embedded credentials cannot acquire that exception.
The browser request-policy identity is now `native-request-boundary-v3`, so
historical captures cannot borrow the new executable conditions as repair proof.
Controlled native fixtures reproduce changed-DNS refusal and exercise HTTP
redirects, cookies, resources, request bodies and WebSockets. Disposable worker
fixtures separately verify HTTPS account lifecycle, monitoring, repair and
recurrence. These checks do not establish production network acceptance.

The shared public-IP classifier uses precise subnet boundaries from the
[IANA IPv4](https://www.iana.org/assignments/iana-ipv4-special-registry/) and
[IPv6](https://www.iana.org/assignments/iana-ipv6-special-registry/) registries.
Globally reachable exceptions retain their specific scope; reserved subnets
cannot exclude neighboring public networks. IPv4-mapped and well-known NAT64
addresses retain the embedded IPv4 boundary. 6to4 and Teredo also require public
embedded endpoints, including Teredo's server and decoded client. Unspecified,
scoped, local, documentation and other non-global IPv6 addresses are refused.
The classifier establishes transport eligibility, never actual reachability.
DNS answers are checked both before the request and at socket connection time.

Browser context admission and setup share the capture deadline and inherited
execution cancellation. Calls without an explicit deadline have a bounded setup
window; prepared sessions retain caller-owned closure. A cancelled allocation
keeps its capacity reservation until allocation fails, the native context emits
closure or leaves the browser inventory, or the browser disconnects. Late contexts close before page setup.
Setup failure and cancellation request isolated closure and fence later request
admission. Failed context cleanup cannot reset the shared browser or release a
live native slot. Controlled Chromium fixtures exercise late allocation, failed
closure, sibling isolation and cancellation during asynchronous request policy.
A repeated Playwright close acknowledgement is insufficient while the context
remains in the browser inventory.

Browser preview access binds HTTP Basic authentication and custom preview headers
to the configured target's exact origin. Native request interception scopes headers
per HTTP hop and applies the existing public-target and action policy to redirects,
including separate embedded renderers. Worker networking remains with its owning
renderer. Cookies retain their declared domain and path, with target-host and
root-path defaults. The request-policy version is part of capture profile identity;
historical observations with different executable conditions cannot certify repair.
Native local fixtures verify authenticated redirects, credential isolation,
private-target rejection, worker rendering and denied mutation replay. They are not
proof of real-provider or production acceptance.

First requests share one context-owned admission handler, including popup
documents and workers. The original page retains the same handler ahead of
configured page routes, with request identity preventing duplicate admission.
Native interception owns redirects and credential headers on each hop. Auxiliary
requests wait for their native redirect boundary before transport. Concurrent
contexts keep separate policies, headers and closure, and closing an owner page
does not dispose a live context's request authority. Read-only WebSocket refusal
also belongs to the context, including its auxiliary pages.
State-changing document navigation is limited to the original main frame.
Account walks already close popups; an auxiliary form cannot create an untracked
identity or replay a mutation through an unobserved redirect. These attempts
record an unavailable auxiliary document and cannot establish account recovery.
Controlled fixtures exercise original-document authorization, refused initial
popup POSTs, redirect replay refusal, nested pages, workers, sockets and concurrent
credential isolation. Historical capture conditions cannot borrow this boundary
as proof of comparable repair.

New checks seal an access decision at admission: current saved Site access,
explicit one-off credentials, or public access. They never inherit credentials
from a parent report or acquire saved credentials later. Saved access has an
origin and grant reference. Replacing or removing executable credentials rotates
that reference, cancels unfinished dependent checks and fences their writers.
Restoring the same credentials cannot revive an old grant. A note-only change
retains the reference. Completed evidence remains immutable; one-off and public
admissions remain independent. Legacy credential snapshots require a matching,
currently authorized legacy Site grant before execution.

Saved website access retains its authorizing owner separately from current Site
ownership. A new owner gets public admission until supplying credentials; old
borrowed Audit snapshots cannot become executable access. Supplying the same
credentials under a different owner creates a fresh grant reference. New
credentials require the active-account lock before the Site lock, while explicit
revocation remains available to an inactive owner. Settings use the grant reader
for both encrypted credentials and the public revocation marker. Removing access
therefore remains a readable unconfigured state. The additive migration preserves
retained decisions under the owner baseline at migration time, without recovering
historical authorizer provenance. Original Audit ciphertext remains historical.

Basic authentication and custom headers use the admitted grant's origin,
including separately fetched flow destinations. Default cookies use its hostname
without rebasing onto a foreign destination; explicit cookie domains and paths
retain browser semantics. Native primary-action and form evidence include the
capture's access and profile identity in their comparison scope. Disposable local
database, queue and browser checks provide local evidence, not production proof.

Browser credential eligibility follows the approved grant origin even when the
initial page uses another origin. Basic authentication and custom headers remain
scoped during the initial request and can become usable after an approved-origin
redirect. Cookies retain their declared domains and paths. Foreign authentication
challenges receive no Basic credentials. Basic or header captures that start
outside the grant origin record the updated
replay policy in their access identity, so earlier observations cannot borrow
newly authenticated evidence as recovery proof. Same-origin and public capture
identities, and captures using only cookies, retain their existing contract.

HTML compatibility fetching and raw HTTP documents share one bounded transport.
Configured request headers stay on the original origin through redirect handling.
The transport cancels redirect bodies and validates each destination. A response
body deadline after headers arrive remains incomplete evidence, rather than proof
that the server never returned an HTTP response.

## Authentication invariants

- New anonymous website analyses start private. Their signed creator claim authorizes initial report and screenshot access before signup; knowing a record URL does not. Claiming preserves the same evidence and transfers access to the authenticated owner. Private report pages do not publish indexed metadata or evidence-bearing Open Graph images. Existing public reports and explicit retries of those reports retain their public compatibility contract. Attached-review navigation checks each child independently and derives presentation permissions from the selected review.
- better-auth 1.6 with Prisma adapter (PostgreSQL)
- Email/password + Google OAuth + GitHub OAuth resolved at runtime
- Passkeys via `@better-auth/passkey` (WebAuthn). Users register passkeys in Settings, sign in with passkey, or use passkey as the second factor after password.
- Optional passkey 2FA via better-auth `twoFactor` plugin (`skipVerificationOnEnable`, TOTP disabled). Email/password sign-in with `twoFactorEnabled` issues a challenge cookie; completion is passkey assertion or a one-time backup code. Enabling 2FA requires at least one registered passkey.
- Session cookie: `better-auth.session_token` (dev), `__Secure-*` / `__Host-*` (production)
- `proxy.ts` does cookie-presence checks only and must not import Prisma or authentication services.
- Protected pages (`/admin/`, `/settings/`) are gated by the request proxy; server validates session on API routes.
- admin role configured via `ADMIN_USER_IDS` env var
- Newly created developer keys carry an explicit MCP permission set and a 30, 90, or 365 day expiry. The default is read-only evidence for 90 days. CLI device approval issues a 90-day key for the complete Fix → Verify workflow. Existing empty-scope account keys retain their historical full-access behavior until the owner replaces or revokes them; every non-empty scope set is enforced even without an OAuth audience.
- CLI approval shares the active-account lock and developer-key limit with Settings, then locks the device code for one terminal decision. Device-code expiry can revoke only its approved, uncollected key in the same conditional transaction. A collected key keeps its own lifetime, including when another client starts login. Cleanup is bounded, and decryption failure cannot consume the one-use credential. Disposable database fixtures verify lifecycle, concurrent decisions, account refusal and token-handler collection; external CLI acceptance remains separate.
- MCP host validation uses the configured app origin, not the incoming request URL or Host header as its authority. Loopback aliases are accepted only for an explicitly configured loopback app. Browser origins must match the configured protocol and port; nonbrowser clients may omit Origin.
- MCP OAuth consumes an authorization code or rotates a refresh token in the same active-owner transaction that creates both replacement credentials. Failed writes roll back consumption, and competing exchanges retain one winner. Expiry is rechecked at consumption. Client metadata URLs use the shared public DNS and socket boundary, refuse redirects and incomplete or oversized JSON, and still require the exact declared client and redirect identities. Controlled database and native-socket fixtures cover these contracts; they do not establish external-client or production acceptance.

## Report access invariants

- Client Site refreshes validate the complete matching projection and update an explicit Site cache key. Captured callbacks and closed streams cannot redirect an old Site's result into the current Site after navigation. Server ownership checks remain the authorization boundary; cached display state never authorizes a write. Settings controls submit only edited notification fields and render validated server values rather than inferred mutation results.
- Anonymous report claims use an HttpOnly, SameSite=Lax HMAC proof scoped to one audit ID and a bounded expiry. A raw or tampered audit ID cannot transfer ownership. A linked Site must still belong to the claiming account in the serializable claim transaction. Report possession does not authorize restoring or changing another account's Site after an ownership change.
- `/post-login` awaits the anonymous claim before passkey enrollment or onward navigation. A failed claim leaves the user on the recovery screen.
- The client session provider shares an in-flight claim with joining consumers and session refreshes. Earlier session reads cannot overwrite its owner state, loading state, or refusal. This display ordering does not replace server authorization.
- Authorized anonymous creator responses may include confirmed Flags, private captures, textual evidence, rubric results, and deterministic scan messages. Historical public reports retain their explicit public access policy.
- Anonymous live-report responses omit fix prompts, Timeline events and playback metadata, pipeline logs, owner and plan state, Product Memory, private history, Canvas data, and watch configuration.
- Repository-owned curated samples may ship versioned static Timeline fixtures because they contain no production report payload or private viewer data.
- `/report/[id]` is the canonical report URL. Copy link preserves its access policy and does not grant access by itself.
- Legacy `/share/[token]` reads remain compatibility-only. The product no longer creates or manages protected share links. Do not treat `ShareLink.passwordHash` as a live product contract.
- Retired Canvas records remain private historical data. Creation and management APIs are absent.

## Captured evidence access

- New Site runs, anonymous analyses and credentialed captures are private at Audit creation. Signed creator access and historical public compatibility follow the authentication invariant above.
- Private screenshots stream through `/api/screenshots` after `resolveAuditAccess`; public-report compatibility remains unchanged. Responses and new screenshot objects use `private, no-store`.
- `/api/integrity-assets` authorizes the owner of the persisted Outcome RunRequest, or an active Shopify path's linked Site owner / verified Shopify ID-token session. Knowing an artifact URL does not grant access. Invalid namespaces and path traversal are rejected before storage reads.
- Journey media uses the same private object transport as screenshots, including caller cancellation, a shared deadline, path-style configuration and physical socket cleanup. Production never substitutes worker-local files for bucket storage. Prefix deletion reaches the actual bucket and reports incomplete deletion. Outcome browser journeys qualify artifact namespaces by execution generation.
- Shopify uninstall revokes stored credentials and disables scheduling before optional media deletion. Cleanup uses each durable path ID's namespace, including frame-only and unreceipted artifacts, rather than depending on a saved video URL. Failed cleanup retains shop/path records for reconciliation; the signed webhook returns failure instead of acknowledging incomplete processing. Asset ownership accepts the complete admitted RunRequest UUID as well as historical alphanumeric IDs.
- Flag detail shows a capture only through its exact persisted JourneyFinding and source Audit in the same Site. Preserve the raw Flag ID separately from its durable Improvement ID. Do not substitute the latest Site thumbnail for failure evidence.
- Derived flow comparisons read only desktop assets in the exact source Audit's namespace on the configured app origin. Unique walk asset names prevent sibling captures from overwriting original frames. Foreign, traversing, mismatched and ambiguous historical references cannot trigger a replacement navigation or storage read. Derived images retain their qualified source references.
- Local signed S3-compatible protocol tests do not establish a real bucket's permissions. Release requires credentialed private-bucket upload, owner retrieval, denied cross-tenant/anonymous retrieval, and actual display.

## Monitoring controls

- Safe Form configuration retains its supplying owner. Creation, replacement, authorization, revocation and deletion use short User then Site transactions and compare the current owner at the write. New configuration and authorization require an active account; revocation and deletion remain available to an inactive owner. Origin validation uses the locked Site URL. Setup, submission, current fixture views and Outcome comparability refuse another owner's configuration. Outcome binding changes recheck ownership and fixture permission under the same locks.
- Safe Form replay checks every prior unsettled submission, rather than the most recent operation alone. Cleanup receipts match the exact operation, Site, fixture and version, including settlement recorded by a later recovery run. Each reconciliation makes at most two cleanup calls; uninspected work cannot grant replay. An admitted operation retains only its exact cleanup permission after setup or account availability changes. New reset and submission still require live authorization and execution ownership. Changed configuration cannot redirect cleanup through new hooks.
- Shopify connection replacement and uninstall increment the authorization version; routine token renewal retains it. Refresh completion compares the exact admitted credentials and version before writing, so an old response cannot restore revoked credentials or replace a newer connection. Path publication, scheduling and advice use short guarded transactions in Project, Shop, Path lock order, with browser, provider and queue operations outside the transaction.
- Shopify path history and its current receipt reference commit together. Late observations cannot replace a newer receipt, publish under a revoked connection or reschedule work. Alerts require that exact committed source and recheck the current connection and recipient before each provider call. Delivery metrics require provider acceptance; notification claims use the persisted attempt evidence. Each path attempt has a unique media namespace; confirmed rejection deletes only that attempt's artifacts.
- Watch classification and completion timestamps require a completed, dated observation belonging to the current active Site owner. Conditional writes recheck that source and ownership, so stale readers cannot mark another owner's Site as checked. Direct notification delivery also requires the durable projection receipt. Classification and provider admission compare current recipient and preferences; accepted provider receipts remain fenced by the admitted attempt and lease. Watch and uptime freeze the exact provider body atomically with that permission-checked claim, comparing the previously selected payload. A delayed claim cannot start a provider request without its full bounded request window remaining.
- Legacy Project deletion delegates to the same locked Site removal command as the Site and operator APIs. Remaining account acknowledgement, execution fencing and retained evidence apply on every path. Removed Sites are excluded from the legacy list and identity edits compare owner and non-deletion at the actual write.
- Explicit restoration through URL admission, signed claim or Project creation rechecks capacity and resumes default public monitoring in the identity transaction. It preserves Outcome identity, historical observation dates and disabled privileged account checks. Ordinary paused Sites remain paused, and background setup never restores a removed Site. Creation responses read the resulting committed schedule rather than the pre-setup row.
- Schedule changes, pause and resume use one domain command. The conditional Site write checks current ownership, non-deletion and the selected cadence and due state. Enabling also requires an active owner. Schedule and derived Outcome freshness commit in the same transaction, including operator-supplied parent transactions. A failed or stale write cannot publish new freshness.
- Saving an unchanged active cadence retains the original due intent, scheduler lease and retry state. Resume resolves the current stored cadence and makes paused monitoring due immediately. Pause retains that cadence and does not require policy or Redis availability.
- Operator Watch reconciliation requires a specific Site and a current scoped operation before changing scheduler state. Scheduled admission retains the operator identity and operation reference. Reuse of a recorded scheduled run revalidates operator authority, including current administrator role, session and operation lease.

## Uptime evidence

- Uptime history and incident projections require the Site owner. History cursors are scoped to the monitor, target generation, and selected window.
- Queue jobs contain monitor references and schedule identities, never a caller-provided URL or tenant authority. Eligibility, ownership, target version, and monitoring state are rechecked before requests and persistence.
- Basic uptime is included separately on every plan. Analysis cadence, billing grants and a halted next-analysis clock do not revoke reachability monitoring or its notifications. Current Site ownership, active account lifecycle, explicit monitoring intent, preferences and target generation remain enforced at execution and delivery boundaries.
- Explicit monitoring pause is stored separately from cadence and next analysis time. Pause atomically disables uptime and invalidates probe leases, retaining incident history. Scheduling, admission, current status, completion recovery and alert claims compare that pause state. Already admitted provider calls retain their acceptance evidence; queued alerts cannot acquire new permission while paused. Resume retains the configured cadence, and removed-Site restoration clears the pause through owner admission. The additive migration recognizes known explicit pause markers without converting quota or halted-clock states into a pause; its timestamp is a migration baseline, not historical provenance.
- Uptime uses strict public HTTP fetching even when development permits localhost for other analysis fixtures. DNS, redirect, size, and deadline guards remain enforced. Probes never replay browser credentials.
- A successful HTTP observation can close only a reachability incident in the same target generation. It cannot verify or recover a Flag that requires rendered-page or browser evidence.

## Secrets management

- All secrets are environment variables
- Per-check Search Console evidence requires the current Site owner, property and admitted grant at commit. Project and connection locks fence transfer and revocation against that write. Changed authorization remains unknown and cannot certify repair. Legacy account token refresh also compares its original credential and active owner before writing; the returned token carries its resulting grant for the same evidence fence. Earlier committed observations remain historical evidence.
- Site Google grants retain `authorizedByUserId` independently of current Site ownership. Token reads and refreshes, context publication, per-check Search admission and disconnect require that authorizer to remain the current owner. Upkeep excludes mismatches before its batch limit. Connection views hide a former owner's provider metadata and facts without deleting stored observations. Only a fresh OAuth callback can bind the new owner; it clears the former property identity before new context is published. The additive migration binds retained grants to their current owner as a compatibility baseline, not reconstructed historical authorization. Erasing an authorizer nulls that binding.
- `.env.local` is gitignored
- Shared Google OAuth and report failures retain bounded response interpretation, typed failure codes and retry delay without publishing raw provider error bodies. Temporary transport or provider failures cannot revoke a grant or require reconnection merely because an exception mentions authorization.
- Google OAuth completion compares the admitted Site owner, active account and original target after code exchange, before creating or replacing credentials. Token refresh and provider context writes retain the expected owner from admission. Short transactions lock User, Project and connection in that order, with provider calls outside the transaction, so transfer, removal or lifecycle changes cannot cross the final permission comparison and credential or fact write. Initial and replacement grant refusals and delayed refresh/context ownership changes have disposable database proof.
- No hardcoded secrets, tokens, or passwords in source
- Site Google credentials are read and refreshed only against the current non-revoked credential snapshot on a non-deleted Site with an active owner. Refresh writes and context commits compare the admitted encrypted credentials and owner lifecycle, so a delayed operation cannot restore a disconnected grant, replace a newer connection's facts or publish context after suspension or erasure begins. Scheduled context upkeep excludes inactive owners before its bounded selection. Permission failures compare the original grant rather than a newly rotated access token. New authorization replaces the prior refresh credential, including clearing it when Google supplies none. Disconnect clears local credentials before requesting provider revocation.
- Analytics reads filter the matched property to the owning Site's exact bare and www hostname aliases. Each stored observation records that property and hostname scope. Readers require it to match the current Site and connection; older unscoped observations remain stored but cannot supply Site traffic context. Page counts and Site audience aggregates stay separate, and missing provider metrics cannot become zero or clear a Flag. Page-specific context also requires the original reported pagePath dimension to match the stored path exactly. Legacy hostname-only page facts remain stored without page attribution; independently scoped Site audience totals retain their authority.
- Explicit Analytics watched-page queries derive bounded paths from the owned Site entry and saved pages, preserving the hostname filter. Foreign URLs, embedded credentials and malformed values are excluded; query strings and fragments are never sent as page-path filters. Page views remain a distinct provider metric, never relabeled sessions.
- Analytics discovery follows provider page tokens within its existing time budget and a bounded request count. A saved property is rechecked directly against its current streams and the owning Site's hostname aliases. Property resource names must have Google's numeric `properties/{id}` form before entering a request path. Incomplete discovery cannot relabel retained facts as a property mismatch or broaden the report's hostname scope.
- Connected Search Console context uses the same Site hostname boundary before the provider selects its top rows. Returned rows must also have a public HTTP(S) source URL inside the matched property and exact Site aliases. The full source URL stays in the fact's scope separately from its display path. Page-specific context matches that URI, including protocol, hostname, port, trailing slash and query conditions. Site hostname aliases alone cannot establish page equivalence. Readers withhold unscoped or mismatched facts. Unavailable aggregate context does not prevent independent URL inspection with current valid credentials; revoked grants, mismatched properties and reauthentication requirements remain enforced.
- GitHub tokens encrypted with AES-256-GCM via `TOKEN_ENCRYPTION_KEY`
- API keys are SHA-256 hashed, stored with an `ff_live_` prefix hint and last four characters only, shown once at creation, permission-scoped, expiring, and revocable. Listing keys never returns the hash or secret.
- Stripe webhook signature verified on every event

## Production access

- Railway deployment. No direct SSH or DB access without Railway dashboard.
- Database: PostgreSQL 16, accessible only within Railway network.
- Paid-opening evidence may query production Watch records only through the operator-supplied `RELEASE_WATCH_READ_DATABASE_URL`. The release command starts a read-only transaction, serializes only aggregate metrics and a database identity hash, and refuses the disposable release database.
- Redis: accessible only within Railway network.
- No admin accounts in code — seeded via `npm run db:seed` with dev-only credentials.

## Dangerous operations

| Operation | Risk | Guard |
|-----------|------|-------|
| `npm run reset` | Database reset | Not implemented (add guard when created) |
| `prisma migrate reset` | Data loss | Requires confirmation |
| `prisma db push` | Schema drift in prod | Should only use `migrate deploy` in prod |
| Direct DB mutation | Data corruption | Admin dashboard only |
| Worker force-kill | Stuck audits | Recovery scheduler handles within 15 min |

## Rate limiting

`lib/security/rate-limit.ts` uses Redis counters. On Redis connection failure it **fails open** (allows the request) so a Redis outage does not take the product offline. This is an intentional availability tradeoff, not a silent bug. Anonymous teaser limits and the one-website beta allowance remain enforced in application code independent of Redis. Open beta access removes authenticated commercial usage quotas; ownership, permissions, execution deadlines, and concurrency guards still apply.

Product Signal ingestion is the explicit exception.

`/api/products/[id]/signals` fails closed when rate limiting is unavailable because an ingestion outage is safer than accepting an unbounded event stream.

## Product Signal privacy boundary

- Signal write keys are stored hashed, scoped to one Product, bound to one exact HTTP(S) origin, and revocable.
- A completed Product Review is required before a key can be issued.
- The ingestion schema rejects undeclared fields and accepts only navigation, named action/outcome, error type, bounded performance value, release, pathname, anonymous session token, event id, and timestamp.
- Query strings, fragments, input values, form contents, DOM text, identity, headers, bodies, keystrokes, and replay data are not stored.
- Anonymous session tokens are one-way hashed with Product scope before persistence.
- Client event IDs have a Product/source uniqueness constraint for replay protection.
- Raw signals carry a 30-day expiry and are deleted by the worker retention sweep.
- Derived Improvements and verified learning keep Review and evidence provenance without retaining expired raw payloads.

## Dependency risks

- Playwright: production Docker uses system Chromium (no browser download in image); local may use Playwright-managed browser
- Next.js 16: regular updates, check security advisories
- better-auth 1.6: relatively new auth library, audit updates
- BullMQ 5: relies on Redis security
- Runtime packages: `npm run security:audit` blocks every moderate-or-higher advisory.
- Build-only packages: the same gate accepts only exact reviewed advisory URLs and indirect dependency paths recorded in [docs/security/toolchain-risk.md](docs/security/toolchain-risk.md). A new advisory, direct dependency, runtime path, or dependency drift blocks release.

## Prompt injection risks

- Website text, metadata, screenshots, retained observations and provider output are untrusted. `lib/audit/metadata.ts` extracts bounded text and removes selected non-prose nodes; `lib/audit/page-text-limits.ts` owns the limits. Text extraction and truncation do not remove instructions or establish resistance to prompt injection.
- `lib/prompts/system-prompt.ts` separates stable system instructions from per-request page data. Provider structured-output tools collect assessment data; they do not authorize application actions. Role separation, JSON schemas and prompt wording cannot by themselves establish semantic correctness.
- `lib/audit/triage-grounding.ts` checks assessment references against recorded sources. Prescription validation and `lib/audit/prescription-scope.ts` bind guidance to exact admitted findings, evidence and hashes. These contracts constrain publication; they do not make a model-generated diagnosis inherently trustworthy.
- Permissions, origin restrictions, credential grants, effect admission and independent verification remain enforced outside model output through the Site application and native request boundary. Page instructions and an agent's completion claim cannot grant authority or close a Flag.
- Copied repair bundles identify recorded website evidence as untrusted and preserve scope and independent verification requirements. The recipient's coding tool must still enforce its own permissions. Current adversarial acceptance remains a separate proof requirement; passing parser, custody or boundary tests is not a general prompt-injection security guarantee.

## Billing (production)

- Revenue deploys set `BILLING_REQUIRED=true` and the full Stripe set (secret, webhook secret, five price IDs). Partial config fails boot via `validateStripeBillingEnv`.
- Test vs live is key prefix only (`sk_test_` / `sk_live_`). Never mix test price IDs with live keys.
- Webhook events: `customer.subscription.*`, `invoice.payment_failed|payment_succeeded`, `checkout.session.completed|expired`, `charge.refunded`.
- Operator setup: `docs/stripe-setup.md`. Never commit secrets; use `.env.local` + Railway variables.

## Approval requirements

| Action | Approval |
|--------|----------|
| Schema changes | `npm run db:check` + `npm run db:drift` |
| env.example changes | Review for secrets exposure |
| Worker index.ts changes | Full audit cycle test |
| Request proxy changes | Verify cookie gating, headers and dependency isolation; preserve server-side authorization |
| Stripe webhook handler | Verify signature verification + plan sync on payment_failed |
| AI prompt changes | Verify prompt injection safety |

## Out of scope

- Penetration testing (pre-revenue, no sensitive user data)
- SOC2 / compliance (pre-revenue)
- VPC / network isolation (Railway managed)
- Secrets rotation policy (single founder, manual rotation)

## Automatic Site accounts

- Account execution requires an owned, private Site run, current entitlement and preference revision, complete mailbox/encryption configuration, and explicit lifecycle-verification enablement. Anonymous checks never create accounts.
- One retained account and one unresolved disposable account are reserved per Site origin. Persist submission admission before the request. Interrupted signup is reconciled through the same identity, never replayed as a new signup.
- Credentials and browser storage are encrypted. Cookie and local-storage replay is restricted to the account's exact origin. Public-safe receipts contain no credentials, email contents or verification tokens.
- Signed-in inspection blocks unrelated mutations, external navigation, payment/download paths, sockets and workers. Deletion is limited to the disposable identity unless the owner explicitly requests test-account cleanup.
- Resend receiving verifies raw-body Svix signatures with bounded timestamps, deduplicates provider email IDs, matches one exact active recipient, and retrieves content only from the fixed Resend API. Extracted same-origin verification data is encrypted with a 15-minute expiry.
- Preference changes increment a revision. Account tasks check that revision, entitlement and execution ownership before privileged requests. Existing Safe Form fixture authorization and cleanup invariants remain independent.
- Shared task deadlines revoke the handler's write authority through nested execution scopes, including asynchronous continuations. Guarded transactions check cancellation before and after their callback so expired work rolls back instead of publishing late state. Cancellation does not undo an external effect; protected retries still reconcile the original identity before another attempt.
- Coordinator and task claims, writes, lease renewal and resource cancellation share the source Audit's current Site authority. A live token cannot borrow a new owner's entitlement or authorize account actions after transfer. The Site fence remains held through each guarded commit, and stale deliveries cannot consume a new generation or protected attempt. Cleanup retains its deletion and inactive-account exception only for the same owner. Anonymous checks may continue through a claim that attaches their original Audit to the claiming owner; fresh runs preserve Site test identities and automatic preferences. Disposable PostgreSQL and Chromium fixtures verify these boundaries locally.
- Account and configured Signup request policies execute in the shared native boundary once per physical request hop, including HTTP redirects. Browser events retain the admitted execution's async context so permission transactions keep lease fences. Signup mutations require submission admission and a current exact-version fixture grant. External redirects cannot bypass the origin boundary, and suppressed telemetry cannot consume an account mutation or invalidate read-only inspection.
- Rendered error documents may be retained only when inspecting an existing active or deleting account. Normal discovery and signup keep strict response capture, and challenge detection remains enforced. The disposable HTTPS lifecycle fixture uses an exact validation origin, temporary credentials and simulated receiving content; it neither sends email nor enables production lifecycle gates.

## Task and verification custody

Queue tasks and verification receipts occupy separate tables. Task claims,
renewal and cancellation use the task table and retain the current Site and
account authority fence. A receipt's optional task relationship includes its
Audit ID, so another Audit's task cannot supply its source relationship. The
combined coverage view is read-only in PostgreSQL and in the Prisma client.
The migration preserves task identities, generations, artifacts, lease values
and receipt provenance. Mixed-version writers are unsupported during this
migration; follow the coordinated runtime procedure in DEVELOPMENT.md.
