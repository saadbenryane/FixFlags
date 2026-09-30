# Absence-based recovery proof lives on the parent Flag

- Date: 2026-09-30
- Scope: Watch diff summaries, recovery notifications, and resolved Flag proof
- Confidence: high

## Evidence

`diffFlagsAgainstParent` resolves a Flag when it is absent from a completed, comparable child audit. The persisted `FIXED` row and `resolvedInId` therefore belong to the parent audit. The inherited recovery-email implementation searched only `child.flags`, so no genuinely recovered Flag could be selected and the email fell back to the Flags list.

The focused regression now passes with a child audit that contains no recovered Flag while `summary.fixed` carries the parent Flag ID. The generated destination is `/sites/{projectId}/flags/{parentFlagId}?source=watch-email`.

## Discovery

A diff bucket is not merely descriptive text. When a downstream surface must link to evidence, each summary item needs the stable persisted identity from the side of the comparison that owns that evidence:

- `fixed` and `inconclusive`: parent Flag ID
- `unchanged`, `regressed`, and `newIssues`: child Flag ID

Matching a summary back to child rows by problem and check ID cannot recover an absence-based result and is weaker than the identity already known during diffing.

## Why it matters

FixFlags can correctly verify a recovery and send an honest notification while still stranding the customer away from the proof. That breaks the final mile of Flag → Fix → Verify and makes unattended monitoring feel like an untraceable claim.

## Correct approach

Carry the exact Flag ID in `FlagDiffSummaryItem` when the diff is built. Consumers that need a durable destination should use that ID directly. A resolved proof read must also require the referenced audit to be `COMPLETED` and belong to the same customer Site.

## Prevention encoded

- `FlagDiffSummaryItem` can carry the persisted `id`, and `getFlagDiffSummary` now fills it from the correct side of the comparison.
- `project-watch.test.ts` proves a recovery email reaches the parent Flag even though the child has no recovered row.
- `SiteFlagsView.test.tsx` guards the same-Site and completed-audit proof constraints and the time-bounded customer wording.
