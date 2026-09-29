# A claimed side effect is a lease, not a state

**Date:** 2026-09-29
**Scope:** `lib/audit/project-watch.ts`, `prisma/schema.prisma`
**Confidence:** HIGH
**Evidence:** Reviewer reproduction on baseline `19843d3b` showed a worker that died after writing `watchNotificationStatus: 'SENDING'` left the row permanently undeliverable, because `retryPendingWatchNotifications` selected only `{ in: ['PENDING', 'FAILED'] }` and no alternate SENDING recovery existed anywhere in the repository. After the fix, a stranded row is retryable, an in-flight row is excluded, a held lease rejects a claim, and an expired lease grants it, confirmed against a real PostgreSQL database.

## Discovery

The delivery claim wrote `SENDING` and incremented the attempt counter in one `updateMany`, then called the email provider. Between those two steps the process can die. `SENDING` was treated as a terminal in-progress marker rather than a leased claim, so the only retry query could never observe the interrupted row. The alert was lost with no error, no log, and nothing shown to the customer.

The failure was invisible in both directions: no alert reached the customer, and no diagnostic reached the operator. Telemetry that claims coverage while silently dropping the thing it covers is worse than no telemetry, because it converts an outage into a false assurance.

## A filter is not enough when the database holds the constraint

The lease pattern was then applied to `RunRequest`, the spine every initiator uses. There the first version was **wrong in a way the tests caught and the reasoning did not**.

`RunRequest` carried no lease, and `QUEUED`/`RUNNING` both counted as active. A worker death therefore stranded the row, and the active-run check reused it: every later request, including scheduled Watch, was handed the stale `auditId` instead of a fresh verification. Scheduled Watch would silently stop verifying anything at all.

The first fix was a lease column plus `leaseUntil: { gt: now }` on the active check. That predicate was written **backwards**: it selected runs whose lease had *expired* as the active ones. The test that encoded the database's own semantics failed immediately and located it.

The real obstacle was one level deeper. `run_requests_one_active_site_idx` is

```sql
CREATE UNIQUE INDEX run_requests_one_active_site_idx
  ON run_requests("projectId")
  WHERE "status" IN ('QUEUED','RUNNING')
```

A partial index predicate cannot call `now()`, so the database kept treating the abandoned run as active and rejected every replacement insert with `P2002`. Excluding the stranded run from the query would have traded a stale result for a raw write error, which is not an improvement. Verified directly: with a stranded row present, a fresh `runRequest.create` fails with `P2002`.

Expiry therefore has to be made **terminal**, and it has to happen where the customer is actually blocked, which is at the point a new run is requested. A periodic sweep would leave a Free Site blocked for a whole Watch interval, because those Sites are only checked weekly.

Two further decisions follow from the index being the real authority:

- **Reclaim before the busy check, not after.** Ordering is the fix. Reclaiming afterwards still hits `P2002`.
- **A run whose audit already COMPLETED is reconciled, not failed.** A worker can die after verifying but before recording it. The assessments exist and are real, so failing the run would throw away a completed verification. Reconciliation runs first, and only a run whose audit never finished is marked `RUN_ABANDONED`.

A failed read or a failed reconciliation must not leave the Site blocked, so both are caught and the run still becomes terminal. The audit itself remains recoverable through the existing stuck-audit sweep.

## Why it matters

`SENDING` looked like a safe design. It is the correct state to write, because it prevents two workers from double-sending. The defect is treating a state that can be entered without leaving as if it always has an exit. Any claim that wraps an external side effect has this shape: a provider call, a payment, a queue publish, a file write. The row is not the source of truth for whether the work completed; the provider is. A claim must therefore be recoverable by a later reader, not only by its original writer.

This matters most for the promises FixFlags is sold on. "Trustworthy while unattended" fails in exactly one way that cannot be repaired later: the customer is never told their site broke, and they believe it is being watched. On `RunRequest` the same defect was one layer more damaging, because it did not merely lose one alert, it stopped every future verification for that Site.

## Correct approach

1. Every claim records a lease expiry in the same write that takes the claim. Follow the existing `Project.watchLeaseUntil` convention rather than inventing a parallel one.
2. Put the lease condition in the claim's `where` clause, not only in a read-time guard. The read is an optimisation; the database is the authority. Two workers racing on one row must not both believe they own the delivery.
3. Clear the lease on every terminal outcome, both success and failure, so a delivered or failed alert never looks in flight.
4. **Check whether a database constraint can express the lease predicate.** A partial unique index over the status cannot call `now()`, so it will outvote your query. When it does, expiry must be made terminal, not merely filtered.
5. **Reclaim where the customer is blocked, not on a schedule.** A sweep that runs every two minutes still leaves a weekly Watch Site blocked for a week.
6. Before failing a stranded claim, look for work that already succeeded. A completed audit behind a dead worker is a real result, and reconciling it is strictly better than reporting a failure.
7. Keep any retry ceiling separate from the lease. Reclaiming an abandoned claim must not let a permanently failing notification loop forever.
8. Keep the provider idempotency key stable across reclaims, so recovering a stranded claim cannot double-send. Verify this survives the retry path, not just the first send.
9. Re-run the claim path with a mock that honours the `where` clause. A mock that ignores it will let a claim succeed that a real database rejects, which is how this class of bug hides behind a green test.

## Rejected approaches

- **Widening the sweep to `in: ['PENDING', 'FAILED', 'SENDING']`.** Makes every in-flight delivery eligible for a second worker to steal, so a slow provider call produces duplicate alerts. The lease predicate is what makes reclaim safe.
- **Recovering SENDING on worker startup only.** Fixes redeploys and leaves an alert stranded by a mid-run OOM, a crashed container, or a network partition. The sweep is the only path that runs while the system is merely unhealthy rather than down.
- **Treating the attempt counter as the recovery mechanism.** Attempts are incremented on claim, so the counter is already spent by the time the worker dies; capping on it suppresses the retry instead of enabling it.
- **Replacing the partial unique index with one that includes the lease.** A partial index predicate must be immutable and cannot call `now()`, so the lease cannot appear in the predicate. The index is not the thing that is wrong; it is the thing that reveals expiry has to be a state transition.
- **A periodic reclamation sweep alone.** It fixes the row eventually, not when the customer asks. Free Sites are watched weekly, so a stranded run would keep that Site unable to verify for up to a week.
- **Failing every stranded run for simplicity.** Throws away the case where the worker died after verifying but before recording it, which is a completed verification the customer paid for.

## Prevention encoded

- Schema comments on `watchNotificationLeaseUntil` and `RunRequest.leaseUntil` record why each column exists, so a later cleanup does not remove the only thing making an in-progress state recoverable.
- Eight focused tests cover reclaim, lease exclusion, the claim predicate being the authority, lease release on terminal outcomes, terminal-on-expiry, reclaim-before-busy-check ordering, reconciliation of an already-completed audit, and the reclaim query being the exact inverse of the active check.
- Partial indexes on `(watchNotificationStatus, updatedAt)` support the Watch sweep.
- Real-database probes confirmed both fix sets, not just the mocks. For `RunRequest` the decisive check was that a stranded row fails a fresh insert with `P2002` and the same insert succeeds after reclamation, while a live lease still rejects a second insert so overlapping runs cannot double-run. The mock-only version would have passed while the Site stayed blocked.

## Production evidence

The Watch notification lease deployed as `80888d14`; `/api/health` and `/api/health/ready` both green with the new `migrations` subsystem ok, and `migrations: ok` is itself proof the column and index applied against the real Railway database.

Read-only production query afterwards: column applied, index applied, **0 stranded SENDING rows**, 0 PENDING/FAILED undelivered, 16 SENT Watch alerts across 1 watched Site. The defect was therefore latent rather than currently costing a customer an alert. That is worth stating plainly: the fix removes a real failure mode, it does not rescue an already-lost alert, and it does not prove recovery in production. Nothing was stranded to recover.

The `RunRequest` lease is not yet deployed.

## Open

Recovery is not yet observed in production, because nothing was stranded and no email was sent to a real inbox. The honest test is inducing a regression on a watched Site, killing the worker mid-claim, and confirming the customer receives the alert after the lease expires. That requires a real customer inbox and a deliberate worker kill, and has not been done.

The same reasoning applies to any claim wrapping an external side effect: payment, queue publish, file write. The pattern is now documented, but the other call sites have not been audited for it. `OutcomeBindingExecution` in `checkout-execution.ts` is the most likely remaining candidate, since it also guards an external browser side effect and is skipped when a record already exists.
