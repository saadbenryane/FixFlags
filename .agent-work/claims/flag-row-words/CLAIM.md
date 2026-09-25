# flag-row-words

## Strategic objective

**Outcome:** A Flag on the Site names its area and severity in customer words.

**Why now:** The first result says "search · important". That is an internal id, and it is the line above the problem.

**Customer impact:** The row and the Flag page say "Search · Important Flag".

**Scope:** One label helper, the Site flag row, and the Flag page eyebrow.

**Out of scope:** Marketing copy, the copied prompt, nav, Shopify, connections, checkout, and the summary notice.

objective: Flag rows use the card name and the existing severity label
outcome: Customers see Search · Important Flag, not search · important
surfaces: lib/sites/flag-label.ts, components/sites/SiteBoard.tsx FlagRow, app/sites/[siteId]/flags/[flagId]/page.tsx eyebrow, tests
dependencies: Does not edit lib/marketing/copy, lib/sites/board-card.ts, or nav. Reuses severityLabel and CARD_CATALOG.
status: complete
agent: grok-goal-01a0d506
timestamp: 2026-09-24T20:46:37Z
completed: 2026-09-24T20:49:00Z
verification: flag-label.test.ts and SiteBoard.test.tsx passed. The example.com board and Flag page show Search · Important Flag. The internal id search · important is gone. Phone screenshot shows the sentence-case label above the Flag.
remaining: The summary note still uses the existing scanner sentence. Paid checkout, the production canary, and a Google grant stay closed.
next: The public MCP footer when lib/site/nav.ts is released. Do not restyle this label back to uppercase ids.
