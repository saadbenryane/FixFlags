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
