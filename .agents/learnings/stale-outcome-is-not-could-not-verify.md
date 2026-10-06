# A stale Outcome is not Couldn’t verify

**Date:** 2026-10-05
**Scope:** Outcome detail history and freshness
**Confidence:** HIGH
**Evidence:** Signed-in page for the local page-loads Outcome, then `loadSiteOutcomeDetail` and `outcomeFreshnessDisclosure` tests passed twice (24/24).

## Discovery

`currentOutcomeState` turns an expired Clear or Flag into Stale. The history title kept only Clear and Flag, and called every other state Couldn’t verify. The page also rendered the stale next step only inside the limitation section, which Stale does not have. How this is checked said the evidence remains current for a raw minute count.

## Why it matters

The customer saw a completed check described as something FixFlags could not establish, and a freshness line that still sounded current.

## Correct approach

Title history with `outcomeStatusLabel`. Show the fresh-verification sentence on the current answer. Describe the freshness window as a rule, and say when this result is past it.

## Prevention

The detail test expects Stale, the completed-check summary, and the fresh-verification sentence for an expired Clear assessment. The state test expects the 8-day rule and the past-window sentence.

## Local walk

Better Auth trusts the configured auth origin. This workspace uses `http://127.0.0.1:3107`. A dev server on `localhost:3000` rejects sign-in.
