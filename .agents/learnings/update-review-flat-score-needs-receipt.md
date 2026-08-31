# Update review flat score needs a receipt

**Date:** 2026-08-31
**Scope:** report header, Agent transcript, update-review diff
**Confidence:** high
**Evidence:** `recheckDiff` was loaded on `/report/[id]` and only fired analytics; outcome cards lived on `/products/[id]`

## Discovery

The customer lands on the child report after Update review. A flat score with a new Flag list looks like the work did not count. The Fixed / New split already existed off the path.

## Correct approach

The child report is the receipt. Repeat the outcome counts there and explain a flat score: Fixed Flags are gone; New observations offset them. Agent says the same. Product keeps the durable cards.

## Prevention

- `lib/audit/update-review-progress.ts`
- `ReportOutcomeBar` mounts `RecheckDiffStrip` when `summary.updateDiff` exists
- Agent `update-outcome` message on completed child Reviews
