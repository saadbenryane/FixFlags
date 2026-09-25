# summary-skipped

## Strategic objective

**Outcome:** A finished Site check that skipped the written summary says so. The check is not labeled failed, and Retry is not offered for a missing provider key.

**Why now:** The first result can be COMPLETED with AI_PROVIDER_NOT_CONFIGURED while the board stays quiet. The customer can treat a partial result as a full review.

**Customer impact:** They still see the Flags from the browser checks, and a plain note that the written summary did not run.

**Scope:** `siteSummaryNotice` and the Site board note that renders it.

**Out of scope:** Marketing copy, the failed-check Retry panel, Shopify, connections, checkout execution, homepage, and the production canary.

objective: A completed check with a skipped summary tells the truth
outcome: The board shows the existing triage sentence and does not say Check failed or offer Retry
surfaces: lib/sites/check-notice.ts, components/sites/SiteBoard.tsx, lib/sites/__tests__/check-notice.test.ts, components/sites/__tests__/SiteBoard.test.tsx
dependencies: Does not edit marketing copy, nav, Shopify, connections, homepage, or checkout execution. Reuses AUDIT_ERRORS strings.
status: complete
agent: grok-goal-01a0d506
timestamp: 2026-09-24T20:35:30Z
completed: 2026-09-24T20:43:00Z
verification: check-notice.test.ts and SiteBoard.test.tsx passed (12). A stored example.com Site whose check is COMPLETED with AI_PROVIDER_NOT_CONFIGURED shows the summary sentence, keeps the Flag, and does not say Check failed or offer Retry. Desktop and phone overflow 0.
remaining: Paid checkout stays closed. Exact-SHA production canary and a live Google grant were not run. A fresh example.org POST hit a Next dev webpack error, not a product response.
next: Public MCP footer and the analytics sentence stay with their current claims. Do not reopen this notice as a failed check.
