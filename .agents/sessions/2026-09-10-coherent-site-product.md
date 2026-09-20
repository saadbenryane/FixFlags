# Coherent Site product implementation

Status: in progress. Owner: codex-root. Branch: main.

The owner approved the complete plan in this task. This record tracks implementation, not release completion. Existing working-tree changes are preserved.

## Accepted boundaries

- New Site experience governs architecture; retain data and billing identities.
- Free weekly browser monitoring; no availability pulse. Paid checkout stays closed.
- FixFlags explains, hands off and verifies; no external protective actions.
- Provider-backed capabilities require actual authorization/refresh/sync/revocation proof.

## Required work

- [ ] A: development migrations; Site application boundaries; query purity; explicit failures.
- [ ] B: observed Pages/Journeys; correction and claim integrity; execution-based coverage and freshness.
- [ ] C: durable complete Flag projection, lifecycle, verification specifications and artifacts.
- [ ] D: protected handoffs; real revocable sharing; independent scheduled capacity; recoverable notifications/preferences.
- [ ] E: Site-bound Shopify/GSC/GA4/Meta/deployments; minimal observer with retention and real provider proof.
- [ ] F: grounded Site Agent/support; Site MCP/CLI; member roles/invitations/assignment.
- [ ] G: retire redundant experiences; align customer language and canonical documentation.
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
