# confirm-shows-page

## Strategic objective

**Outcome:** After Confirm this page, the board shows "This page loads" and does not say FixFlags is watching unless Watch is on.

**Why now:** The nav claim is still active. The post-confirm board said "watching" and could still show "No Outcome yet".

**Customer impact:** They see the page outcome immediately, with Couldn't verify and Verify, and no watch claim.

**Scope:** The home lead sentence and the confirm handler's immediate outcome.

**Out of scope:** `lib/site/nav.ts`, marketing copy files, Flag row labels, and checkout.

objective: Confirming a page shows that page and does not claim Watch
outcome: The board shows This page loads without saying FixFlags is watching
surfaces: lib/sites/first-outcome.ts homeBoardLead, SiteBoard confirm handler and home subtitle
dependencies: Does not edit lib/site/nav.ts. stranger-shopify-ready still owns that file.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:59:47Z
completed: 2026-09-24T21:03:00Z
verification: homeBoardLead and SiteBoard tests passed. Arrival and example.com confirm at 375 and 1280 showed This page loads, Couldn't verify, and Verify, with no watching sentence. MCP footer remains because nav.ts is still claimed. Confirmation text sits under the heading so it does not cover a Flag.
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. MCP footer stays claimed.
next: Remove the public MCP link when stranger-shopify-ready releases lib/site/nav.ts.
