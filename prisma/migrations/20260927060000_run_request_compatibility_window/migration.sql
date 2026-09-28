-- RunRequestOutcome is authoritative, but retain the former scalar selection
-- during the release compatibility window. The column added in
-- 20260921153000_checkout_outcome_run_requests is converted in place: same
-- name, same type, same index. It is never removed and re-added, so the
-- previous revision keeps reading it while this deploy runs.
--
-- Parity contract: requestSiteRun sorts its selection before it writes, and the
-- dual-write takes selectedIds[0], so both this backfill and the application
-- choose the lowest outcomeId for a multi-Outcome run. If the application ever
-- stops sorting, this backfill must change in the same commit that changes it.
--
-- A blocked conversion must fail and roll back rather than hold the container
-- open until the platform healthcheck kills it mid-deploy. `migrate deploy`
-- leaves lock_timeout and statement_timeout at 0, so an unbounded wait here
-- would hang container boot rather than report a cause. `SET LOCAL` is scoped to
-- the transaction `migrate deploy` already opens around this file.
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

-- The pre-launch constraint cascaded a deleted Outcome's runs away with it. A
-- nullable compatibility column must not delete history, so it becomes SET NULL.
ALTER TABLE "run_requests" DROP CONSTRAINT IF EXISTS "run_requests_outcomeId_fkey";

-- Converge every run on its authoritative selection receipt. This column was
-- the only selection before the multi-Outcome migration, so any run whose scalar
-- and receipt disagree is repaired here rather than left ambiguous.
UPDATE "run_requests" AS request
SET "outcomeId" = selection."outcomeId"
FROM (
  SELECT DISTINCT ON ("runRequestId") "runRequestId", "outcomeId"
  FROM "run_request_outcomes"
  ORDER BY "runRequestId", "outcomeId"
) AS selection
WHERE request."id" = selection."runRequestId";

ALTER TABLE "run_requests" ALTER COLUMN "outcomeId" DROP NOT NULL;

-- The index is unchanged from the pre-launch definition and is never dropped.
-- IF NOT EXISTS keeps a retry after a crash between the commit and the
-- _prisma_migrations ledger write a no-op instead of a hard failure.
CREATE INDEX IF NOT EXISTS "run_requests_outcomeId_requestedAt_idx"
  ON "run_requests"("outcomeId", "requestedAt" DESC);

-- Guarded the same way, because a bare ADD CONSTRAINT would abort a retry that
-- re-runs this file after a crash between the commit and the ledger write.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'run_requests_outcomeId_fkey'
      AND conrelid = 'run_requests'::regclass
  ) THEN
    ALTER TABLE "run_requests"
      ADD CONSTRAINT "run_requests_outcomeId_fkey"
      FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
