# Watch reliability and economics evidence

Date: 2026-10-05
Owner: codex-root
State: implemented and locally verified; not deployed or customer-validated

## Outcome

The 14-day/100-scheduled-execution Watch release boundary is now an executable evidence gate instead of a prose checklist. Operators can inspect the same projection in Admin analytics or with:

```bash
npm run watch:launch-readiness
npm run watch:launch-readiness -- --require-pass
```

The strict form exits non-zero until every gate passes. It does not enable Stripe, publish MCP, or mutate customer data.

## Evidence contract

The projection reads the existing durable `RunRequest`, `Audit`, `OutcomeAssessment`, `Flag` occurrence, notification, and `AuditRunCost` records. It reports:

- a complete 14-day window and at least 100 scheduled Watch executions;
- at least 99% terminal completion after excluding explicit target outage codes;
- zero abandoned or lease-expired scheduled runs;
- a durable success or failure record for every attempted notification;
- exercised unchanged-Clear runs that stayed quiet;
- exercised repeated customer failures that retained one active Flag identity;
- complete cost coverage and projected p50 daily-care COGS at or below $12 per Site per month.

Each gate is `passed`, `failed`, `collecting`, or `unavailable`. Empty samples and unexercised notification, quiet-success, and deduplication paths cannot pass. Missing cost records are unavailable, not zero-cost runs.

## Durable recovery classification

`watchRegressionCount = 0` was ambiguous: it could mean an unchanged Clear result or a verified recovery. The additive `Audit.watchRecoveryCount` field now records the distinction when Watch computes its diff. Historical ambiguous rows remain `NULL` and make quiet-success evidence unavailable. A sent historical notification is never rewritten while attempting classification, preventing duplicate delivery.

## Verification

- Focused Watch and analytics suites: 26 tests passed.
- TypeScript, changed-file lint, Prisma validation, skills validation, knowledge duplication guard, and growth evaluator passed.
- Upgraded local database applied `20261005190000_watch_recovery_evidence`; doctor and drift checks passed.
- A disposable fresh database applied all 101 migrations and reported current, then was dropped.
- The real local command reported `collecting` with zero executions. The strict command exited 1 as intended.
- Full repository verification passed all 30 commands, including unit and coverage suites, optimized Next build, direct worker bundle, security/runtime dependency inspection, and container build. Receipt: `.agent-runs/2026-10-05T18-55-25-846Z-container-build.log`.

## Status boundary

- Implemented and locally verified.
- Not production verified because the candidate has not been pushed or deployed.
- Not customer validated because no representative production cohort has run for 14 days or reached 100 scheduled executions.
- Paid access remains waitlisted. Public MCP discovery remains closed.
