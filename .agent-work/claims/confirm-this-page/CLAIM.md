# confirm-this-page

## Strategic objective

**Outcome:** The first Site's next action confirms the page. It does not say a Watch schedule started.

**Why now:** `lib/site/nav.ts` is still claimed. "Watch this page" only saves an Outcome and toasts "Outcome saved".

**Customer impact:** The button says "Confirm this page". Success says the page is confirmed. An auth failure opens sign-in and returns to the Site.

**Scope:** `FIRST_OUTCOME_COPY`, the Site board handler, and the tests that render them.

**Out of scope:** Nav, marketing copy files, the summary notice, Flag rows, and checkout.

objective: The empty-outcome action matches what the click does
outcome: Confirm this page confirms the page. It does not claim Watch started.
surfaces: lib/sites/first-outcome.ts, components/sites/SiteBoard.tsx watchPage only, matching tests
dependencies: Does not edit lib/site/nav.ts. plain-summary-note owns the summary sentence, not this button.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:54:15Z
completed: 2026-09-24T20:58:00Z
verification: first-outcome and SiteBoard tests passed. Signed-out arrival, example.com Flags, and Confirm this page were walked at 375 and 1280. After confirm, the board shows This page loads, Couldn't verify, and Verify. final-review.txt records the open gates.
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. MCP footer stays claimed in lib/site/nav.ts.
next: Remove that footer link when the nav claim is released.
