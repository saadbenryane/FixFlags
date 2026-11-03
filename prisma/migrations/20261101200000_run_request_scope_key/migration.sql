-- The composite foreign key keeps every replay key on its owning Site.
-- Build the reference index without blocking ordinary request writes.
CREATE UNIQUE INDEX CONCURRENTLY "run_requests_id_projectId_key"
  ON "run_requests" ("id", "projectId");
