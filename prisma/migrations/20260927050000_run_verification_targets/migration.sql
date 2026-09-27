-- RunRequestOutcome has been the authoritative selection receipt since the
-- multi-Outcome migration. Rehearse the backfill again before dropping the
-- redundant scalar so upgraded databases cannot lose a selection.
INSERT INTO "run_request_outcomes" ("runRequestId", "outcomeId")
SELECT "id", "outcomeId" FROM "run_requests"
ON CONFLICT ("runRequestId", "outcomeId") DO NOTHING;

ALTER TABLE "run_requests" ADD COLUMN "verificationTarget" JSONB;

ALTER TABLE "run_requests" DROP CONSTRAINT "run_requests_outcomeId_fkey";
DROP INDEX "run_requests_outcomeId_requestedAt_idx";
ALTER TABLE "run_requests" DROP COLUMN "outcomeId";
