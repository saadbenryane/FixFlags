ALTER TABLE "projects" ADD COLUMN "monitoringSetupRetryAt" TIMESTAMP(3);

CREATE INDEX "projects_monitoringSetupRetryAt_createdAt_id_idx" ON "projects"("monitoringSetupRetryAt", "createdAt", "id");
