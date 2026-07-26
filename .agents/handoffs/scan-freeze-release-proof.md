# Scan freeze release proof handoff

*Updated: 2026-07-26. Local implementation is complete. This handoff contains only operator-dependent release proof.*

## Proven locally

- The web role enqueues and serves reports without owning BullMQ workers or Playwright.
- The worker role owns exactly one worker instance and browser lifecycle; local concurrency defaults to one.
- Submitting `saadbenryane.com` reached the progressive report without a frozen frame. The warmed report route rendered in 0.49 seconds.
- Audit `cms10xj8n0001gr82h9f3l989` completed `FULL` in 155 seconds without a stage restart, and browser contexts returned to zero.
- Under an active scan, measured homepage, worker-health, and report-status responses were 388 ms, 57 ms, and 42 ms.
- Progressive report layouts at 320, 375, 768, and 1280 px had no horizontal overflow. Browser Back and invalid-URL recovery worked.
- `npm run verify`, `npm run accuracy:eval`, the production web build, worker build, and Docker build pass.

## Required operator inputs

The local environment does not contain:

- `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`
- `RELEASE_SMOKE_URL`
- `RELEASE_FRESH_DATABASE_URL`
- `RELEASE_ALLOW_DATABASE_RESET`

An operator must also explicitly consent to the guarded reset of the disposable `fixflags_release` database. Do not point `RELEASE_FRESH_DATABASE_URL` at a shared or production database.

## Completion sequence

1. Provision R2 and email variables in both the release environment and the applicable deployed services.
2. Deploy the web service with `FIXFLAGS_PROCESS_ROLE=web` and the worker service with `FIXFLAGS_PROCESS_ROLE=worker`; set production `AUDIT_WORKER_CONCURRENCY=2`.
3. Confirm `/api/health/ready` and `/api/health/worker` report one fresh external worker heartbeat, zero leaked contexts, and no overdue jobs.
4. Set the disposable release database URL and reset flag only after explicit reset consent.
5. Set `RELEASE_SMOKE_URL` to the deployed web origin and run `npm run verify:release`.
6. Verify an R2-backed capture URL survives a worker restart and remains readable from its report.
7. Trigger a real Product Watch regression and confirm delivery to the configured recipient.
8. Run the credentialed anonymous, account, billing, re-check, protected-share, Product Watch, MCP, and CLI journeys.

Release must remain unapproved until these steps produce recorded evidence in `.agents/sessions/credentialed-journey-matrix.md`.
