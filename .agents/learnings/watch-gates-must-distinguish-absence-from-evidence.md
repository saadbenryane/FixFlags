# Watch gates must distinguish absence from evidence

Date: 2026-10-05
Scope: unattended Watch reliability, notification truth, Flag deduplication, and economics
Confidence: high

## Evidence

The Watch launch checklist required no lost runs, durable notifications, quiet unchanged Clear results, deduplicated repeated failures, and bounded COGS. Existing durable rows could measure most of it, but a zero-regression audit could not distinguish an unchanged result from a recovery because only regression count was stored.

## Discovery

Counting zero errors or zero notifications is not proof when the relevant path was never exercised. A gate also cannot infer quiet success from notification status alone because a recovery notification is valid. Missing cost rows cannot be priced as zero.

## Correct approach

- Give operational gates explicit `passed`, `failed`, `collecting`, and `unavailable` states.
- Require representative paths to be exercised before passing notification, quiet-success, and deduplication gates.
- Persist the minimum discriminator needed to interpret historical evidence; here, `watchRecoveryCount` separates recovery from unchanged Clear.
- Keep target outages separate from platform completion failures.
- Require durable cost coverage before projecting economics.

## Prevention encoded

- `lib/analytics/watch-launch-readiness.ts` centralizes the calculation and database projection.
- Focused tests cover passing, collecting, failed, target-excluded, and unavailable evidence.
- `npm run watch:launch-readiness -- --require-pass` is a non-zero release gate until every condition passes.
- Admin analytics shows the same projection rather than recomputing parallel metrics.
- Historical ambiguous rows remain unavailable evidence instead of being backfilled by guesswork.
