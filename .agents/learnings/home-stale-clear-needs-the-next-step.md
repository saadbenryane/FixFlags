# Home must repeat the stale next step

**Date:** 2026-10-05
**Scope:** Site Home Outcome card
**Confidence:** HIGH
**Evidence:** `SiteBoard` rendered a stale Clear without the next step, then the board, detail, and state tests passed twice (53/53). A signed-in Home walk showed the sentence.

## Discovery

The Outcome page already said Stale and asked for a fresh verification. Home kept the stored Clear sentence as the lead and said only “Last verified.”

## Why it matters

Home is the first answer. A completed-check sentence without the freshness limit reads as a result the customer can rely on.

## Correct approach

Keep the last answer. Add `staleOutcomeRecovery()` when the state is Stale. Build the freshness line from `outcomeFreshnessDisclosure` so Home and the Outcome page use one window sentence.

## Prevention

The board test expects the fresh-verification sentence, the 8-day window, and the past-window line for a stale Clear, and expects a current Clear to omit them.
