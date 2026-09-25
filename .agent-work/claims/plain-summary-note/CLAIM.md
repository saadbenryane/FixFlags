# plain-summary-note

## Strategic objective

**Outcome:** A finished check that skipped the written summary explains that in plain words.

**Why now:** The first line on that Site says "provider key", "scanner", and "deterministic checks".

**Customer impact:** They read that the written summary did not run, and that the Flags come from the browser check.

**Scope:** `siteSummaryNotice` and the tests that render its sentence.

**Out of scope:** Site board retry and refresh, marketing copy files, nav, Flag rows, Shopify, and checkout.

objective: The skipped-summary note does not use operator language
outcome: The board sentence says the written summary did not run and the Flags come from the browser check
surfaces: lib/sites/check-notice.ts, lib/sites/__tests__/check-notice.test.ts, the SiteBoard assertion for that sentence
dependencies: Does not edit SiteBoard.tsx while retry-clears-failure owns retry and refresh. Does not edit lib/marketing/copy.
status: complete
agent: grok-goal-01a0d506
timestamp: 2026-09-24T20:50:31Z
completed: 2026-09-24T20:52:00Z
verification: check-notice and SiteBoard tests passed (13). The example.com Site HTML contains the plain sentence and does not contain scanner, provider key, deterministic, or Check failed.
next: The missing-description Flag still says to view page source. That is the next unclaimed line on the same result.
