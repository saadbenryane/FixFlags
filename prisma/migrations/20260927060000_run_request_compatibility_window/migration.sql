-- RunRequestOutcome is authoritative, but retain the former scalar selection
-- during the release compatibility window. This is a forward-only repair for
-- the preceding contract migration and allows old readers to coexist while a
-- complete weekly Watch cycle and production rollback are proven.
--
-- Parity contract: requestSiteRun sorts its selection before it writes, and the
-- dual-write takes selectedIds[0], so both this backfill and the application
-- choose the lowest outcomeId for a multi-Outcome run. If the application ever
-- stops sorting, this backfill must change in the same commit that changes it.
ALTER TABLE "run_requests" ADD COLUMN "outcomeId" TEXT;

UPDATE "run_requests" AS request
SET "outcomeId" = selection."outcomeId"
FROM (
  SELECT DISTINCT ON ("runRequestId") "runRequestId", "outcomeId"
  FROM "run_request_outcomes"
  ORDER BY "runRequestId", "outcomeId"
) AS selection
WHERE request."id" = selection."runRequestId";

CREATE INDEX "run_requests_outcomeId_requestedAt_idx"
  ON "run_requests"("outcomeId", "requestedAt" DESC);

ALTER TABLE "run_requests"
  ADD CONSTRAINT "run_requests_outcomeId_fkey"
  FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
