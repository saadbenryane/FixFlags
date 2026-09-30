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

## A recorded failure that is never stated is the same defect, seen by the customer

Both leases were correct once the claim itself was recoverable. The remaining half of the same problem was on the other side of the claim: `watchBoardState` derives the Site's Watch state from the schedule and from run failures only. A Site whose alert channel was dead therefore showed "Watching weekly" and looked healthy, while the customer heard nothing at all.

Watch is sold on telling you when your site breaks. A delivery channel that failed quietly converts that promise into a false one, and the customer has no way to notice, because the only symptom is an absence. That is the same failure as a stranded claim, one level out: work that is recorded but never surfaced. A database row nobody reads is not a customer promise.

Three decisions carry over from the lease work:

- **Delivery is not coverage.** The Site really was checked, and saying so is the point. `watchIsCovered` is untouched, because a broken alert channel must not make the system claim the Site stopped being monitored. The two facts are reported side by side instead of collapsing into one state.
- **Read the evidence, do not re-derive it.** Delivery is a property of one alert, so the verdict is computed from the most recent warranted Watch alert. An older undelivered alert stays visible until a later alert is actually delivered, so nobody is told they were warned about a change nobody reached them about. A `NOT_APPLICABLE` run is never treated as a delivery claim.
- **Terminal is not the same as failed.** A `FAILED` alert with retries left reads as in progress, because the bounded retry exists precisely so FixFlags keeps trying before admitting failure. Calling it terminal early is a false alarm about a system that is working.

One thing that was wrong on the first attempt and is worth stating as a general rule: **the new read was unguarded.** Every other tenant-scoped read in that file is conditioned on a resolved `projectId`, and a provisional Site has none, so `projectId: null` matched other tenants' unscoped Watch alerts. It looked correct, typechecked, and passed every test that did not read the file. Adding a query to a file full of guarded queries does not make it guarded. An undelivered alert is precisely the state that must never leak sideways, and a test now pins the guard by reading the source.

The provider error is never shown. `watchNotificationLastError` holds vendor internals, so the customer is told about their inbox and the evidence stays in the database and logs. A test asserts the copy leaks nothing about the provider.

## The mirror image: value nobody is told about is also invisible

The delivery work is a failure that was recorded and never stated. The opposite turned up next, and it is the same shape: a capability that exists and is never surfaced. Production had Watch enabled on **1 of 11 Sites**. Watch is the entire differentiator; the homepage already argues it, "a report from that run" versus a tool that keeps watching.

`docs/workspace-interface.md` gives Home the question "what is FixFlags watching and what needs attention?" When Watch was off, Home answered only the second half: a sidebar reading "Not watching", a lead line about Flags. The one surface whose documented job was to answer the watching question was the surface that did not answer it, and silence about a disabled promise reads as the promise being kept.

Two things worth generalizing.

**A surface has to answer its own documented question.** The gap was not a missing feature, it was a mismatch between `docs/workspace-interface.md` and the code, and it was only findable by asking what each surface claims to answer and then reading it. The fix was to bring the code into line with the existing doc, not to write a new one.

**State the gap, do not close it by fiat.** The tempting move was a "Turn on Watch" control on Home, because it is one button and it would clearly raise activation. It was rejected. Turning Watch on sends email, so consent is the customer's, and `docs/workspace-interface.md` assigns Watch configuration to Site settings, not Home. Home states the fact and links to the surface that owns the choice. Two tests hold that line: the Home section may not grow an `onClick`, and `lib/audit/create-audit.ts` may never set `watchInterval`, so scanning cannot switch Watch on as a side effect.

**The loose-matcher trap.** A pre-existing test asserted Home never claims Watch is on, using `queryByText(/watching/i)`. That assertion started failing the moment honest copy said "not watching", which is the tell that the matcher was weaker than the invariant. It was tightened to the actual invariant, "Watching weekly" is absent, plus a positive assertion that the honest off-state is present. Weakening a guard because honest copy trips it is how a guard becomes decorative.

One limit stated plainly: the evidence for the gap is 1 of 11 Sites watched. That is a read-only production query, not proof that this line raises activation. With 4 users and sessions ending Sep 12, nobody can currently diagnose retention from this data, and the honest claim is only that Home was silent on a question it owns.

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

The `RunRequest` lease deployed as `9a2732ca`, with `/api/health` and `/api/health/ready` both green and the `migrations` subsystem ok, which is itself proof the column applied against the real Railway database.

A read-only production query afterwards: `run_requests.leaseUntil` present, **0** rows in `QUEUED` or `RUNNING`, 0 with an expired lease, 0 legacy NULL leases, and 0 `RUN_ABANDONED`. No Site was blocked and nothing was reclaimed. The defect was latent in production too, so this deploy removed a failure mode rather than repairing a live incident. It does not prove that reclamation works in production, because there was nothing to reclaim.

Alert delivery honesty deployed as `a23919f5`, healthy with `migrations: ok` and readiness 200. Read-only production query: 16 Watch alerts, all **SENT**, 0 PENDING, 0 FAILED at any attempt count, and a maximum of 1 attempt ever made. **No customer would see the new notice today.** So that was latent too: it removes a way for a broken alert channel to look healthy rather than repairing a live incident, and it does not prove the notice reads well to a real customer, because no real customer has had an alert fail to deliver.

## Open

Recovery is not yet observed in production, on any of this. Nothing was stranded and no email was sent to a real inbox. The honest tests are: for the notification lease, induce a regression on a watched Site, kill the worker mid-claim, and confirm the customer receives the alert after the lease expires; for the run lease, strand a run, request a new one, and confirm the Site verifies again instead of returning the stale audit or a `P2002`; for the notice, point a watched Site at a bad email address and confirm the customer sees the failure stated rather than a healthy-looking board. All three need a deliberate failure and a real customer, and none has been done.

The same reasoning applies to any claim wrapping an external side effect: payment, queue publish, file write. The pattern is now documented, but the other call sites have not been audited for it. `OutcomeBindingExecution` in `checkout-execution.ts` is the most likely remaining candidate, since it also guards an external browser side effect and is skipped when a record already exists.

## Final-attempt uncertainty, 2026-09-30

Independent review found the attempt ceiling and lease recovery conflicted on the fifth claim. A worker could increment attempts to five, write `SENDING`, call the provider, and die before saving the response. Once the lease expired, the retry sweep excluded the row because attempts were no longer below five, while the customer projection treated every `SENDING` row as active forever.

The correct terminal state is uncertainty, not another send and not a claim that the inbox definitely missed the email. The provider may have accepted the fifth request before the worker died. The repair therefore:

1. includes expired `SENDING` rows in the sweep independently of the retry ceiling;
2. terminalizes an expired final claim as `FAILED` without making a sixth provider call;
3. releases the lease and records an internal diagnostic;
4. projects an exhausted expired claim as terminal even before the sweep persists the transition; and
5. tells the customer FixFlags could not confirm delivery, while Watch keeps checking.

Tests pin both halves: a live fifth lease still reads as delivering, an expired fifth lease does not, and the sender makes no sixth claim or provider call. This remains local evidence. No production alert was deliberately stranded and no real inbox result was observed.
