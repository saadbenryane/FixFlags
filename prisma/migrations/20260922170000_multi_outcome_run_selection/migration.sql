CREATE TABLE "run_request_outcomes" (
  "runRequestId" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  CONSTRAINT "run_request_outcomes_pkey" PRIMARY KEY ("runRequestId", "outcomeId")
);

ALTER TABLE "run_request_outcomes"
  ADD CONSTRAINT "run_request_outcomes_runRequestId_fkey"
  FOREIGN KEY ("runRequestId") REFERENCES "run_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_request_outcomes"
  ADD CONSTRAINT "run_request_outcomes_outcomeId_fkey"
  FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "run_request_outcomes_outcomeId_runRequestId_idx"
  ON "run_request_outcomes"("outcomeId", "runRequestId");

-- Old Checkout requests selected exactly their existing Outcome.
INSERT INTO "run_request_outcomes" ("runRequestId", "outcomeId")
SELECT "id", "outcomeId" FROM "run_requests";

DROP INDEX "outcome_assessments_runRequestId_key";
CREATE UNIQUE INDEX "outcome_assessments_runRequestId_outcomeId_key"
  ON "outcome_assessments"("runRequestId", "outcomeId");

-- One active physical execution per Site avoids incompatible overlapping
-- Outcome sets sharing an Audit without an explicit selection receipt.
DROP INDEX "run_requests_one_active_outcome_idx";
CREATE UNIQUE INDEX "run_requests_one_active_site_idx"
  ON "run_requests"("projectId")
  WHERE "status" IN ('QUEUED', 'RUNNING');
