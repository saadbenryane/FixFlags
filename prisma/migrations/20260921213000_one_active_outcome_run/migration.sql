-- Only one queued/running execution may own an Outcome at a time. This closes
-- the race between Watch, MCP, and web requests after their read-side dedupe.
CREATE UNIQUE INDEX "run_requests_one_active_outcome_idx"
  ON "run_requests"("outcomeId")
  WHERE "status" IN ('QUEUED', 'RUNNING');
