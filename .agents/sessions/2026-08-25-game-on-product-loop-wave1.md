# Game On product loop Wave 1

## Outcome

The Product Review → Fix → Update review → independent verification service boundary now uses one authenticated and metered manual-review path.

Watch-triggered reviews are the only monitoring path that sets `skipUsageCount`.

The existing serialized Product creation boundary still reuses one active foreground Review, so duplicate clicks and concurrent transports do not create or meter a second Review.

Owner prompt copy remains the idempotent `HANDOFF_COPIED` ledger event.

Ready-to-verify and owner-reported already-fixed actions create or update one open `ImprovementAttempt` and append the attempt ledger event.

Owner accept, reject, duplicate, dismiss, and already-fixed decisions now enter through `lib/improvements/service.ts`.

Visitor thumbs feedback remains a separate `FlagFeedback` write and cannot mutate Improvement lifecycle state.

The unused duplicate Product Improvement GET and attempt routes were removed after repository-wide caller search found no consumers.

## Durable completion and verification

`improvementProjectedAt` is now written only after diff, attention materialization, and verification reconciliation all succeed.

A completed Review with an empty projection receipt resumes projection when the audit runner sees it again.

The worker recovery scheduler also retries a bounded batch of 25 completed unprojected Reviews through the same idempotent service and reports projected and failed counts.

Projection failures remain recoverable, append a pipeline failure event, and are logged by the scheduler instead of being swallowed.

Synchronous `ff_recheck_and_compare` completion and later `ff_get_report` polling now use the same completed-child assembler for diff, Fix List, Finish Plan, technology profile, and verification receipts.

Raw Flag absence is exposed as `noLongerObserved`.

Only a receipt with outcome `IMPROVED` contributes to the `fixed`/“Improved” count.

The packaged CLI preserves the existing command and field while displaying “No longer observed” and “Inconclusive” separately.

Existing exact-verifier coverage remains the certification boundary: partial or degraded Reviews, missing or failed exact verifiers, missing evidence references, uncovered pages, unstable AI identity, and incomplete journeys produce `INCONCLUSIVE` and no verified Product Memory.

## Changed scope

- Audit monitoring, task outcome, finalization, runner, recovery, and scheduler services and focused tests.
- Improvement lifecycle service, owner Flag feedback adapter, and focused tests.
- Manual Update review HTTP access adapter and its root-owned contract test update.
- Shared MCP/CLI recheck result contract and packaged CLI display/tests.
- Removal of the unused `/api/projects/[id]/improvements` GET and nested attempt route.

No Prisma schema, migration, homepage, report presentation, release workflow, analytics, admin, canonical product documentation, Board, or Goal file was changed by this lane.

## Proof

- `npx tsc --noEmit --pretty false --incremental false` passed with stale custom Next type caches temporarily moved aside and restored.
- Focused product-loop suite passed: 120 tests.
- Expanded API, audit, Improvement, and queue suite passed: 1,766 tests with 6 expected skips.
- MCP plus task-contract suite passed: 51 tests.
- Packaged CLI build and test passed: 16 tests.
- Create/reuse and recovery integration selection passed 30 tests with 6 environment-gated skips.
- Focused ESLint passed.
- `npm run mcp:quality-gate` passed with 19 tools.
- `npm run routes:contract-guard` passed with 82 routes.
- `npm run completeness:audit` passed with 69 models, 19 MCP tools, 8 editor integrations, and 7 review context sections.
- `git diff --check` passed.

## Integration needs

The report presentation owner must keep client capability derivation aligned with the server contract and must not expose an Update review action to a claimed anonymous viewer.

The root integration run must regenerate or clear stale `.next-e2e` and `.next-verify` type artifacts before the canonical affected typecheck, because those caches still reference the two intentionally removed routes.

PostgreSQL/Redis integration tests were selected but skipped under the current test environment, so the root credentialed matrix remains responsible for proving concurrent duplicate-click reuse, exact metering, projection recovery, and Watch bypass against real services.

No deployment, production mutation, registry publish, or external credential action occurred in this lane.
