# Outcome evidence must show the newest execution

**Date:** 2026-10-05
**Scope:** Outcome detail evidence card
**Confidence:** HIGH
**Evidence:** `lib/sites/__tests__/outcome-detail-evidence.test.ts` calls `loadSiteOutcomeDetail`. It failed on the older execution, then passed twice (2/2).

## Discovery

`outcomeBindingExecution` is unique per audit, outcome, and binding. Each Verify therefore adds a row. The detail loader sorts those rows newest first and takes 50, then fills a map. The last write wins, so the card showed the oldest row in the window.

The headline assessment was already the newest row. The evidence card could contradict it.

## Why it matters

A customer who fixes Checkout and verifies again can still read the earlier failure as the independent evidence. A later failure can stay hidden behind an earlier success. History is supposed to keep both. The evidence card is supposed to answer what the latest check found.

## Correct approach

Keep the first row for each binding key when the query is newest first. Do not delete older executions or attempts. Do not reorder assessments. The per-audit assessment writer already sees one execution per key and does not need this rule.

## Prevention

The detail test returns two Checkout executions and two page executions in newest-first order, asserts the query stays `createdAt desc`, and expects the newer reason, audit, and customer sentence. It also expects both attempts to remain on the timeline.
