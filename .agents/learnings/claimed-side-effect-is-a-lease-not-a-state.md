# A claimed side effect is a lease, not a state

**Date:** 2026-09-29
**Scope:** `lib/audit/project-watch.ts`, `prisma/schema.prisma`
**Confidence:** HIGH
**Evidence:** Reviewer reproduction on baseline `19843d3b` showed a worker that died after writing `watchNotificationStatus: 'SENDING'` left the row permanently undeliverable, because `retryPendingWatchNotifications` selected only `{ in: ['PENDING', 'FAILED'] }` and no alternate SENDING recovery existed anywhere in the repository. After the fix, a stranded row is retryable, an in-flight row is excluded, a held lease rejects a claim, and an expired lease grants it, confirmed against a real PostgreSQL database.

## Discovery

The delivery claim wrote `SENDING` and incremented the attempt counter in one `updateMany`, then called the email provider. Between those two steps the process can die. `SENDING` was treated as a terminal in-progress marker rather than a leased claim, so the only retry query could never observe the interrupted row. The alert was lost with no error, no log, and nothing shown to the customer.

The failure was invisible in both directions: no alert reached the customer, and no diagnostic reached the operator. Telemetry that claims coverage while silently dropping the thing it covers is worse than no telemetry, because it converts an outage into a false assurance.

## Why it matters

`SENDING` looked like a safe design. It is the correct state to write, because it prevents two workers from double-sending. The defect is treating a state that can be entered without leaving as if it always has an exit. Any claim that wraps an external side effect has this shape: a provider call, a payment, a queue publish, a file write. The row is not the source of truth for whether the work completed; the provider is. A claim must therefore be recoverable by a later reader, not only by its original writer.

This matters most for the promises FixFlags is sold on. "Trustworthy while unattended" fails in exactly one way that cannot be repaired later: the customer is never told their site broke, and they believe it is being watched.

## Correct approach

1. Every claim records a lease expiry in the same write that takes the claim. Follow the existing `Project.watchLeaseUntil` convention rather than inventing a parallel one.
2. Put the lease condition in the claim's `where` clause, not only in a read-time guard. The read is an optimisation; the database is the authority. Two workers racing on one row must not both believe they own the delivery.
3. Clear the lease on every terminal outcome, both success and failure, so a delivered or failed alert never looks in flight.
4. Keep the retry ceiling separate from the lease. Reclaiming an abandoned claim must not let a permanently failing notification loop forever.
5. Keep the provider idempotency key stable across reclaims, so recovering a stranded claim cannot double-send. Verify this survives the retry path, not just the first send.
6. Re-run the claim path with a mock that honours the `where` clause. A mock that ignores it will let a claim succeed that a real database rejects, which is how this class of bug hides behind a green test.

## Rejected approaches

- **Widening the sweep to `in: ['PENDING', 'FAILED', 'SENDING']`.** Makes every in-flight delivery eligible for a second worker to steal, so a slow provider call produces duplicate alerts. The lease predicate is what makes reclaim safe.
- **Recovering SENDING on worker startup only.** Fixes redeploys and leaves an alert stranded by a mid-run OOM, a crashed container, or a network partition. The sweep is the only path that runs while the system is merely unhealthy rather than down.
- **Treating the attempt counter as the recovery mechanism.** Attempts are incremented on claim, so the counter is already spent by the time the worker dies; capping on it suppresses the retry instead of enabling it.

## Prevention encoded

- Schema comment on `watchNotificationLeaseUntil` records why the column exists, so a later cleanup does not remove the only thing making SENDING recoverable.
- Four focused tests cover reclaim, lease exclusion, the claim predicate being the authority, and lease release on terminal outcomes.
- A partial index on `(watchNotificationStatus, updatedAt)` supports the sweep.
- The real-database probe confirmed the five lease invariants; the mock-only version would have passed while the query was wrong.

## Production evidence

Deployed as `80888d14`; `/api/health` and `/api/health/ready` both green with the new `migrations` subsystem ok, and `migrations: ok` is itself proof the column and index applied against the real Railway database.

Read-only production query afterwards: column applied, index applied, **0 stranded SENDING rows**, 0 PENDING/FAILED undelivered, 16 SENT Watch alerts across 1 watched Site. The defect was therefore latent rather than currently costing a customer an alert. That is worth stating plainly: the fix removes a real failure mode, it does not rescue an already-lost alert, and it does not prove recovery in production. Nothing was stranded to recover.

## Open

Recovery is not yet observed in production, because nothing was stranded and no email was sent to a real inbox. The honest test is inducing a regression on a watched Site, killing the worker mid-claim, and confirming the customer receives the alert after the lease expires. That requires a real customer inbox and a deliberate worker kill, and has not been done.

The same reasoning applies to any claim wrapping an external side effect: payment, queue publish, file write. The pattern is now documented, but the other call sites have not been audited for it.
