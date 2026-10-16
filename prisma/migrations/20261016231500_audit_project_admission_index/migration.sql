-- Keep Site-scoped admission and history reads inside the owning Site index range.
CREATE INDEX "audits_project_created_idx" ON "audits"("projectId", "createdAt" DESC);
