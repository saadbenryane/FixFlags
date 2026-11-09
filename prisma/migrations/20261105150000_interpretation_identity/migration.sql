ALTER TABLE "audit_execution_tasks"
  ADD COLUMN "interpretationKey" TEXT,
  ADD COLUMN "interpretationSourceId" TEXT;
CREATE UNIQUE INDEX "audit_execution_tasks_interpretationKey_key" ON "audit_execution_tasks"("interpretationKey");
