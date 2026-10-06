# A Flag attempt names its source and uses the shared clock

**Date:** 2026-10-05
**Scope:** Flag detail verification attempts
**Confidence:** HIGH
**Evidence:** The Flag page render failed on the raw builder, then the page and label tests passed twice (4/4). The local database has no stored attempts.

## Discovery

The attempt line used `Date.toLocaleString()` and printed `attempt.builder`. Home and Outcome proof already use `formatEvidenceTimestamp`.

## Why it matters

A customer comparing a Flag attempt with other Site proof saw a different clock, and the source read as an internal token such as `site` or `copy`.

## Correct approach

Name the source with `customerAttemptSource`. Stamp the attempt time with `formatEvidenceTimestamp`. An unknown builder says “Recorded attempt” rather than the stored token.

## Prevention

The Flag page test renders a Site attempt, a copied attempt, and an unknown token. It expects the customer sources and the shared UTC string, and it rejects the raw tokens.
