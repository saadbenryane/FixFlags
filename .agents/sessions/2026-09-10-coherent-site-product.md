# Coherent Site product implementation

Status: local implementation verified; credentialed release proof remains. Owner: codex-root. Branch: main.

The owner approved the complete plan in this task. This record tracks implementation, not release completion. Existing working-tree changes are preserved.

## Accepted boundaries

- New Site experience governs architecture; retain data and billing identities.
- Free weekly browser monitoring; no availability pulse. Paid checkout stays closed.
- FixFlags explains, hands off and verifies; no external protective actions.
- Provider-backed capabilities require actual authorization/refresh/sync/revocation proof.

## Required work

- [x] A: additive migrations; Site application boundary; owner-scoped queries; explicit failures.
- [x] B: observed Pages/Journeys; correction and claim integrity; execution-based coverage and freshness.
- [x] C: durable customer-Flag projection, occurrence lifecycle, targeted verification attempts and artifacts.
- [x] D: protected Fix handoffs; independent scheduled capacity; recoverable email notifications/preferences. Public Flag sharing remains intentionally absent.
- [x] E: explicitly tenant-linked Shopify connection with embedded authorization and minimized compliance storage. GSC, GA4, Meta and deployments remain intentionally absent from launch.
- [x] F: grounded Site Agent/support with typed citations and minimized escalation. MCP/CLI and team roles remain intentionally absent from launch.
- [x] G: retire reachable redundant experiences; align customer language, Help, Docs, samples, legal, billing and canonical documentation.
- [ ] Acceptance: full checks, browser states, credentialed loop, provider verification, production attestation and rollback.

## Baseline

107 existing changed/untracked files. Doctor: local demo-request migration pending. Completeness audit passes. Focused Site tests, offline accuracy and typecheck passed during planning; these are not end-to-end proof.

## Implementation evidence

Updated as each verified change lands.

### 2026-09-11 baseline

- `npm run doctor`: pass after starting the repository PostgreSQL and Redis services; schema current and Chromium available.
- `npm run completeness:audit`: pass (79 models, two legacy report sections).
- `npm run accuracy:eval`: pass (16 HTML fixtures, three gold fixtures, zero failures).
- `npm run typecheck`: fail in durable Improvement projection.
- `npm run lint`: fail on one source issue plus ignored prototype build output being scanned.
- `npm run test:unit`: 14 failures across Improvement projection, coverage receipts, pricing-era analytics expectations, accessibility contrast, source-language guard and AuditInput static analysis.
- First customer journey and release evidence remain unproven; no launch claim.

### Green-baseline slice

- Fixed complete durable Flag materialization: ranking no longer passes wrapper objects to identity and no longer truncates Site memory to three Flags. Regression proof materializes four distinct customer Flags and occurrences.
- Split pure review access projection from server-only entitlement policy, removing `node:async_hooks` from the client report bundle.
- Reconciled current $49/website analytics expectations, coverage receipts, dynamic AuditInput ID validation and ignored prototype build output.
- Changed Flag Orange foreground from white (3.13:1) to ink (6.29:1) and aligned the design canon.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit` (5,223 passed, 10 skipped) and `npm run ui:drift-guard`: pass.
- Full `npm run verify` advanced through database, type, lint and brand gates, then found application typography/radius/token drift. The focused fixes and affected tests pass; full gate must be rerun from a stable clean revision.

### 2026-09-20 launch baseline and release foundation

- Committed the coherent homepage and integrations slice as `0c7a129f`; Shopify is the available connection and future providers are explicitly unavailable.
- A clean `npm run verify` on `d96af590` passed all gates: schema and drift, typecheck, lint, product/copy/route/knowledge guards, zero moderate-or-higher dependency vulnerabilities, 5,237 unit tests with 10 declared skips, coverage, 16 accuracy fixtures with zero failures, the production Next build, and worker build.
- Fixed the only regression found by the first clean run: the navigation unit assertion and browser journey still expected the retired `For Shopify` link instead of the canonical `Integrations` destination. Commit: `d96af590`.
- Provisioned only the dedicated local `fixflags_release` database. Release foundation `release-20260920-d96af590` passed clean install, 82 fresh migrations, full verification, immutable container build, and a real Postgres + Redis + web + dedicated-worker scan. The report completed successfully (`cmu9ip6ux0001pc2ta10lqc0x`). Generated receipt: `test-results/release/release-20260920-d96af590/foundation.json`.
- Release fixture binding remains correctly blocked before mutation: `RELEASE_E2E_TARGET`, exact-revision `RELEASE_ENV_URL`, and private `RELEASE_FIXTURE_MANIFEST` are absent. Production and credentialed journey claims remain open.
- Public agent distribution under `/.well-known/skills/*` was found exposing the retired Product Review / Product Intelligence model while CLI and MCP are parked. The route is now covered by the same fail-closed 404 boundary as the other parked power tools, with unit and browser contract coverage.
- Playwright CLI exercised the real local public routes at desktop and 375 px. Homepage, pricing, integrations, and signup rendered the Site/Flag model without client errors; pricing showed Free weekly and Pro `$49 /website/mo` daily with charging closed; homepage width equaled scroll width at 375 px; and `/.well-known/skills/fixflags/SKILL.md` returned HTTP 404.
- The deterministic heartbeat now recognizes `parked` and `superseded` as inactive board states. Its JSON packet reports no parse warnings, so release blockers are no longer hidden behind invalid-status noise.

### Complete-product implementation slice

- Replaced the signed-in Products/review-meter dashboard with an owner-scoped Sites list and durable Site Home, Flags, Flag detail and Settings routes. A recoverable Site delete stops Watch and disconnects Shopify; a later Analyze revives the owned hostname.
- Made targeted Verify atomic and idempotent: one pending attempt binds its source occurrence, exact scope, verification audit and final outcome. Missing or incomparable evidence cannot resolve a Flag.
- Separated customer Flags from Recommendations everywhere that creates attention, badges or notification noise.
- Unified Free weekly and paid daily care under one Site policy; targeted Verify skips the retired review pool. Watch activation requires durable Redis and email readiness and reports a retryable state when unavailable.
- Added per-Site notification preferences, recovery control, deduplicated mail, exact-Flag links and return telemetry.
- Replaced Shopify hostname authorization with an explicit `ShopifyShop → Project` connection, single-use signed account links and ID-token-protected embedded loading. Compliance webhooks retain processing identity/result rather than unnecessary customer payloads.
- Added authenticated, Site-scoped Agent threads and messages, bounded evidence context, typed citations and support escalation carrying minimized Site/Flag context.
- Rebuilt Help, Docs, samples, legal, billing and public compatibility around the Site model. Public Project/Product APIs and parked power tools now fail closed; old public report links render sanitized evidence rather than a second workspace.
- Added versioned, idempotent Site lifecycle telemetry and an operator funnel for Analyze through support resolution without raw URL, email, prompt, transcript or evidence properties.
- Made Stripe sandbox subscriptions licensed per Site quantity and webhook reconciliation order-independent. New paid checkout remains closed.
- Focused validation passed during implementation; the exact local gate and browser evidence are recorded below. Credentialed release evidence is still required before launch.

### 2026-09-21 local completion receipt

- `npm run verify` passed on `ef26be30`: 83 migrations current with zero drift; typecheck and lint; product, route, module, SEO, metadata, copy, Help, knowledge, security and completeness guards; 88 script tests; 5,294 unit tests with 10 declared skips; coverage; 16 accuracy fixtures with zero failures; production Next build; worker build; zero moderate-or-higher dependency vulnerabilities.
- Production-like Chromium public matrix: 52 passed, 17 credential/provider journeys explicitly skipped, zero failures. Launch widths, keyboard, 200% text, reduced motion, light/dark, axe, public compatibility/error states and parked-route boundaries passed.
- Focused homepage production matrix: 6 passed. The root hydration mismatch was removed by consent-gating analytics and click-ID capture instead of injecting third-party scripts before hydration.
- Consent contract tests: 5 passed across analytics event gating and preference persistence/reopening. The public footer exposes Cookie settings and privacy copy matches behavior.
- PostgreSQL and Redis local services were healthy; all 83 migrations applied. The new additive Site boundary migration is current.
- Full credentialed Site claim, Verify recurrence, Watch email return, Shopify development-store lifecycle, Stripe Test Clock and exact-SHA production canary remain blocked by absent release environment URL, private fixture manifest and provider credentials. No launch or deployment claim is made.
