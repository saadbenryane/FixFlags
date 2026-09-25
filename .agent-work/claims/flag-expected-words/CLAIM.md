# flag-expected-words

## Strategic objective

**Outcome:** A missing meta description Flag says what should be true after a fix, and the page does not show an empty viewport or a certainty score.

**Why now:** The first Flag's expected result says "View page source, confirm meta name=description".

**Customer impact:** They read that the page should include a description a search result can show.

**Scope:** The description-missing rule, the Site Flag read path, and the Flag page evidence rows.

**Out of scope:** Rewriting every verification rule, Site board retry, marketing copy, and nav.

objective: The missing-description Flag states the result, not a page-source procedure
outcome: Expected after a fix is a customer sentence. Certainty and an unrecorded viewport are not shown.
surfaces: lib/audit/verification-rules.ts description-missing, lib/sites/flag-label.ts, lib/sites/flags.ts, the Flag page evidence list, tests
dependencies: Does not edit SiteBoard.tsx, marketing copy, or nav.
status: complete
agent: grok-goal-01a0d506
timestamp: 2026-09-24T20:53:15Z
completed: 2026-09-24T20:55:00Z
verification: flag-label tests passed. The example.com Flag page shows the meta description sentence, not view page source, and does not show Certainty or an empty viewport. Verify fix remains. Desktop and phone screenshots.
remaining: Stored fix steps can still mention keywords. The public MCP footer stays claimed in nav. Paid checkout, a Google grant, and the production canary stay closed.
next: Leave the description-missing sentence as the customer result. Do not restore the page-source procedure.
