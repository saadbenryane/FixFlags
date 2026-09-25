# retry-clears-failure

## Strategic objective

**Outcome:** A successful retry leaves the previous Check failed state immediately. The board follows the new run.

**Why now:** Desktop retry returned 200 and the board stayed on Check failed.

**Customer impact:** Retry shows the check has started again, then the next real result replaces that.

**Scope:** Site board retry and its refresh. Not the Flag row another agent is editing.

**Out of scope:** Nav, marketing copy, Flag row labels, checkout, and the accuracy corpus.

objective: A 200 retry no longer keeps the old Check failed on screen
outcome: The failure notice clears when retry is accepted, and the site read is not cached
surfaces: components/sites/SiteBoard.tsx retry and refresh only
dependencies: flag-row-words is editing FlagRow in the same file. This edit does not touch FlagRow.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:47:48Z
completed: 2026-09-24T20:52:00Z
verification: SiteBoard test shows Check failed leave the screen when retry returns 200, before the site read finishes, and the read uses cache no-store. https://example.com opened a finished Site with Flags and Watch this page at 375 and 1280. Verify dry-run saved.
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. The MCP footer link stays claimed in lib/site/nav.ts.
next: Remove that footer link when the nav claim is released.
