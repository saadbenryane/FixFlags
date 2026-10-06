# The home Outcome card must show the assessment

**Date:** 2026-10-05
**Scope:** Site home watched Outcome card
**Confidence:** HIGH
**Evidence:** `components/sites/__tests__/SiteBoard.test.tsx` renders `SiteBoard` and passed twice.

## Discovery

The home card always preferred the Outcome expectation. A stored assessment, including a blocked Checkout reason, stayed off the first screen whenever a promise existed.

## Why it matters

Home is where a customer reads the watched Outcome. The promise says what FixFlags agreed to check. The assessment says what the last verification found. Hiding the assessment leaves Couldn’t verify without a reason.

## Correct approach

Show the assessment when it is a stored result, and keep the promise beside it. Do not show the unassessed placeholder as if it were a result.

## Prevention

`SiteBoard` passes the summary into `OutcomeSummaryCard` unless it is `UNASSESSED_OUTCOME_SUMMARY`. The home render test expects the blocked Checkout sentence and the promise together, and expects the placeholder to stay hidden.
