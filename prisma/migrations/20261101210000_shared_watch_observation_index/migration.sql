-- Shared monitoring recovery starts from committed manual receipts, rather
-- than scanning every completed manual analysis with no notification duty.
CREATE INDEX CONCURRENTLY "run_requests_shared_watch_observation_idx"
ON "run_requests" ("auditId", "projectId", "id")
WHERE "source" <> 'WATCH' AND "environment" = 'production'
  AND "context"#>'{scheduled,version}' = '1'::jsonb;
