# URL-first implementation closeout

Date: 2026-08-25

Parking and usage-plan implementation verdict: **COMPLETE**.

Integrated product verdict: **NOT COMPLETE**.

Release verdict: **NOT YET ATTESTED**.

## Completed product contract

- The public product is URL-first and retains the complete web loop: report, fix prompts, Update review, comparison, history, sharing, Canvas, Product Signals, and Watch.
- Repository scanning, MCP, CLI, API-key setup, GitHub repository integration, deployment hooks, well-known files, and related setup routes remain implemented in place but return not found at the public boundary and are absent from discovery surfaces.
- Free, Pro, and Studio expose the same web capabilities and differ by monthly Product Review and Deep Review capacity.
- New reviews, Update reviews, claimed anonymous reviews, and completed scheduled Watch reviews use the shared Product Review pool.
- Monthly periods roll under transaction-scoped locks, including calendar-month periods for Free accounts.
- Existing subscribers retain price-bound legacy allowances until they change or cancel.
- Commit `6291dcd3` restored Preview, owner-only Timeline playback, Report, and Canvas and passed focused tests.
- A separate report-focused task changed that same shell during final verification to hide Preview, Timeline, and Canvas.
- The current integrated worktree therefore does not satisfy the retained-web-capabilities contract.
- `/api/health` exposes an explicit healthy boolean and a full commit SHA.

## Local proof

- `npm run agent -- verify --full` passed all 25 commands before the concurrent report-shell change.
- The final rerun fails 17 report UI tests because Preview, Timeline, and Canvas are hidden by that concurrent change.
- `npm run power-tools:verify` passed the dormant MCP, CLI, repository, webhook, registry, and release-workflow checks.
- `npm run billing:plans-guard` passed.
- `npm run power-tools:visibility-guard` passed.
- `npm run db:validate`, `npm run db:check`, and `npm run db:drift` passed.
- Focused report workspace, progressive report, status API, pricing, usage, access, analytics, and health tests passed.
- No power-tool source, route module, dependency, database record, worker, or package was deleted or relocated.

## Integration blocker

The report shell has another active owner, as noted by the operator before this task began.
Overwriting that work would violate repository coordination rules.
The report owner must reconcile its simplified Agent/Report-only direction with the approved requirement to retain Preview, Timeline, and Canvas before the full gate can be green again.

## Required production rollout evidence

The following work changes external production state and was not performed:

- Query active production Stripe subscriptions and record which prices need grandfathered allowances.
- Create and configure the new $29 Pro and $79 Studio Stripe prices.
- Deploy the database migrations, web application, and worker from one immutable revision.
- Run the credentialed customer web matrix in the release environment.
- Verify the deployed health response reports the exact full revision.
- Run the zero-skip production URL-to-report dogfood and capture the release receipt.

These are release requirements, not code fallbacks or deferred product design.
