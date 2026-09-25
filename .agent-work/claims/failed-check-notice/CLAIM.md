# failed-check-notice

## Strategic objective

**Outcome:** A Site check that failed is shown as failed, with the existing customer reason and a retry. It is not described as still learning.

**Why now:** The stranger lands on the Site, which never runs the stuck-check recovery the report poll already has. A failed check is labeled "Learning your website".

**Customer impact:** They can see that the check did not finish, why, and retry it.

**Scope:** Site check notice, site-card health for a failed check, best-effort recovery on Site load, and the board notice with retry.

**Out of scope:** Paid checkout, marketing copy, Shopify, connections, checkout execution, and the scan-accuracy corpus.

objective: A failed or stuck Site check tells the truth and can be retried
outcome: Failed checks show Check failed, the existing customer reason, and Retry. They are not labeled as learning.
surfaces: lib/sites/check-notice.ts, lib/sites/site-health.ts, lib/sites/application/queries.ts (recovery call and failureCode only), components/sites/SiteBoard.tsx (notice only), lib/audit/recover-audit-job.ts (worker-down failure code only)
dependencies: does not edit marketing copy, Shopify, connections, checkout execution, or the accuracy corpus. Overlap with Site UI and queries is limited to this notice.
status: complete
agent: grok-goal-01a0d504
timestamp: 2026-09-24T20:14:05Z
completed: 2026-09-24T20:30:00Z
verification: check-notice.test.ts, recover-audit-job.test.ts, and SiteBoard.test.ts passed (37 tests). A local Site for an unreachable example.com path showed Check failed, the unreachable reason, Retry, and Couldn't verify at 375 and 1280, not Learning your website. Retry returned 200 and the worker started the check again. It failed again as unreachable, so the board stayed failed.
remaining: Paid checkout stays closed. Exact-SHA production canary was not run. The footer still links to MCP for agents, and the analytics choice still says product journeys. Both sit in files claimed by stranger-shopify-ready.
next: The footer MCP link, if that claim is released. Otherwise the production canary remains an external gate.
decision: A failed Site check uses the existing customer error and the existing report retry. Stuck checks use the same recovery the report poll already runs, once an update is older than 15 seconds. A worker that is down long enough is recorded as AUDIT_JOB_LOST so the board says the scanner is unavailable.
