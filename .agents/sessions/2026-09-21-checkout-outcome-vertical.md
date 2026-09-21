# Checkout Outcome vertical-slice receipt

**Status: local implementation complete; public launch acceptance remains open.** This receipt distinguishes code and local proof from the credentialed production canary required by `docs/product-masterplan.md`.

## Shipped locally

- `SiteOutcome` now has Checkout semantics, an explicit browser execution binding, a durable assessment, and an Outcome-attributed incident link. Both migrations are additive; the second enforces one active RunRequest per Outcome in PostgreSQL.
- Web verification, targeted Flag verification, MCP verification, and scheduled Checkout Watch create tenant-scoped RunRequests. The existing Audit queue and Playwright browser perform the work. Scheduled runs also retain broad Site care in the same Audit.
- The independent purchase-path probe yields Clear for confirmed checkout reachability, Flag for reproducible meaningful failure, Couldn't verify for blocked/inconclusive execution, and Stale when the last conclusive evidence expires. A stable Checkout fingerprint retains incident and recovery history.
- The Site board presents Checkout as an important Outcome above implementation-level cards. Homepage example and metadata use the independent-monitor positioning; the documentation and signed-in key/setup paths describe the same Outcome loop.
- The retained MCP transport, account keys, device flow, CLI bridge, and editor setup expose owned Sites, Outcomes, asynchronous runs, Flags, evidence, and re-verification. Free accounts can create a key. Interactive web/MCP/API verification is bounded to 24 new runs per Site per rolling day, independent of scheduled Watch.
- Lifecycle telemetry records Outcome creation, request source, results, latency, and verified recovery.

## Reused

`Project` as owned Site, `Audit` as the physical execution ledger, the existing worker/queue, Playwright purchase-path probe, `JourneyReview` evidence, `Flag`/`Improvement` occurrences and verification attempts, Watch scheduler, existing Site UI, MCP SDK transport/auth, and product analytics. Broad page, security, performance, search, tracking, and commerce checks were not replaced.

## Local proof

- `npm run agent -- verify` passed the 29-command repository validation set, including migration/drift checks, typecheck, lint, 5,314 unit tests, coverage, accuracy corpus, and web/worker builds. The final post-copy rerun is recorded by its `.agent-runs` logs.
- Local database has both additive migrations applied; `npm run db:check`, `npm run db:drift`, and `npm run db:validate` passed.
- The real Playwright purchase-path fixture passed confirmed healthy, reproducible Add-to-cart failure, and unsupported/no-purchase-control cases in `lib/integrity/__tests__/run-path-probe.test.ts`.
- Focused tests cover owner-scoped request creation, idempotent reuse, bounded interactive runs versus uncapped Watch, Watch's broad scan mode, assessment truth, MCP manifest/transport, API-key access, and public copy.
- Rendered local pages returned HTTP 200: homepage at 320 and 1280 px, MCP docs at 320 px. Evidence: `output/playwright/checkout-home-320.png`, `output/playwright/checkout-home-1280.png`, `output/playwright/checkout-mcp-docs-320.png`. The local dev server was stopped after the pass.
- `npm run agent:heartbeat -- --json` returned `ok: true` with no board blocker at the time of this receipt.

## Not yet proven, so not called launch-ready

- A credentialed owned-Site Checkout sequence in a deployed environment: Clear → break → Flag/evidence → fix → Verify → Clear, including recurrence, notification, and Watch after restart.
- Actual Codex, Claude Code, and Cursor client connection against the deployed MCP endpoint; remote OAuth/scopes remain on the launch plan. Local protocol and CLI tests do not replace that proof.
- Exact-SHA production migration/deployment, mobile authenticated Site walkthrough, and the scheduled production canary. No production deployment or paid-checkout opening was performed here.

## Next vertical slice

Add one safe machine-facing HTTP/API Outcome through the same RunRequest and assessment path. It will prove that Outcome identity is independent of browser execution without prematurely building generalized autonomous-agent evaluation.
