-- RunRequestOutcome has been the authoritative selection receipt since the
-- multi-Outcome migration. Rehearse the backfill again so upgraded databases
-- cannot lose a selection.
--
-- "run_requests"."outcomeId" is deliberately NOT dropped here. `prisma migrate
-- deploy` commits each migration file in its own transaction, so dropping the
-- column in this file and re-adding it in the next one leaves production with
-- no "outcomeId" column at all in between, while the previous revision is still
-- running and selects that column on every Outcome, Watch and run path. The
-- following migration converts the same column in place instead, so the column
-- exists before, during and after the deploy.
--
-- A blocked migration must fail and roll back rather than hold the container
-- open until the platform healthcheck kills it mid-deploy. `SET LOCAL` is
-- scoped to the transaction `migrate deploy` already opens around this file, so
-- both timeouts are reverted when the migration commits.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

INSERT INTO "run_request_outcomes" ("runRequestId", "outcomeId")
SELECT "id", "outcomeId" FROM "run_requests"
ON CONFLICT ("runRequestId", "outcomeId") DO NOTHING;

-- IF NOT EXISTS keeps a retry after a crash between this commit and the
-- _prisma_migrations ledger write a no-op instead of a hard failure.
ALTER TABLE "run_requests" ADD COLUMN IF NOT EXISTS "verificationTarget" JSONB;
