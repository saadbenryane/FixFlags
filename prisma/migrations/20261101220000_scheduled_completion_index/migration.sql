-- Match the current Site clock before reading retained execution history.
CREATE INDEX CONCURRENTLY "run_requests_scheduled_completion_idx"
ON "run_requests" (
  "projectId",
  ("context"#>'{scheduled,attemptedAt}'),
  ("context"#>'{scheduled,nextRunAt}'),
  ("context"#>'{scheduled,failures}')
)
WHERE "environment" = 'production'
  AND "context"#>'{scheduled,version}' = '1'::jsonb;
