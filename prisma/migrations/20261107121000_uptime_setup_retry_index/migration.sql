CREATE INDEX CONCURRENTLY "projects_uptimeSetupRetryAt_createdAt_id_idx"
  ON "projects" ("uptimeSetupRetryAt", "createdAt", "id");
