# Paid opening consumes Watch evidence

**Task:** `billing-open-watch-evidence-gate-2026-10-06`  
**Status:** locally verified; paid access remains waitlisted; not deployed

## Discovery

FixFlags already calculated the 14-day/100-run Watch reliability and economics
gate conservatively, exposed it in Admin, and supported a failing CLI check. The
controlled `billing-open` release stage did not consume that calculation. It
could therefore produce a paid-opening receipt from Stripe journeys while the
Watch sample was still collecting or failing.

## Delivered contract

- `billing-open` now runs Watch readiness before its billing journey and stops
  when the projection is not passed.
- The release gate requires an explicit PostgreSQL evidence database distinct
  from the disposable migration-test database. The query runs in a read-only
  transaction.
- The persisted artifact contains aggregate metrics only, is mode `0600`, and
  is bound to the exact candidate SHA plus a hash of the canonical database
  identity. It never stores the database URL.
- Receipt validation requires all seven gate states and independently checks
  14 observation days, at least 100 scheduled executions, at least 99% terminal
  completion, zero lost runs, zero quiet-success violations, zero duplicate
  active-Flag groups, and projected daily-care COGS no greater than $12 per
  Site per month.
- Final receipt aggregation refuses a `billing-open` receipt without that
  passing Watch evidence. Documentation now treats the database as read-only
  operational evidence, not as a disposable release fixture.

## Real-path evidence

- Release-gate mode ran against the existing local database inside a read-only
  transaction and wrote `test-results/release/watch-local-proof.json` without
  exposing the connection string. The artifact was bound to candidate
  `8f012a74911020aa82f238f690787b4a03760631` and a database identity hash.
- The local cohort correctly returned `collecting`, `0/100`, with every gate
  collecting, and `--require-pass` exited 1. This is refusal evidence, not a
  launch pass.
- Release preflight/receipt tests cover missing and same-database refusal,
  command ordering, exact-SHA/database binding, threshold failures, real stage
  wiring with generated artifacts, and final-receipt rejection. The combined
  release test run passed 28/28.
- Watch readiness unit tests passed 4/4. TypeScript, scoped lint, and the
  repository-selected 10-command affected gate passed.
- Final `npm run verify` passed after all ledger edits: database validation and
  drift, TypeScript, lint and repository guards, permanent dependency audit,
  script tests, 5,899 unit assertions (18 skipped), coverage, 16 HTML and 3
  gold accuracy fixtures, optimized Next build, worker bundle, and production
  container. The image build pruned to 544 runtime packages with zero audit
  findings and emitted manifest
  `sha256:b019a777cfaba31b5a00c4f11213ef2ecf63067397b45dc76c687126ae453e7c`.

## Security-gate maintenance

The full verification refresh also caught two advisories published during this
work. Runtime `sharp` now resolves to patched `0.35.5` for
`GHSA-wq5f-xc86-pv6w`; build-only `shell-quote` now resolves to patched
`1.12.0` for `GHSA-pqg4-j6r4-53mv`. The permanent audit passes with a clean
runtime graph and only the existing reviewed `braces` build chain. No
suppression or forced audit rewrite was used.

## Boundary and next evidence

This change enforces the transition but does not satisfy it. The production
Watch cohort still needs 14 days and 100 scheduled executions meeting every
threshold for the exact candidate. No Stripe state, entitlement, customer
account, production database, deployment, or public claim was changed.
