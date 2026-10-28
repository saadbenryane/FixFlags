BEGIN;

-- Preserve the larger task payload storage in place. Old writers must already
-- be stopped before this coordinated cutover starts.
ALTER TABLE "audit_verifier_executions" RENAME TO "audit_execution_tasks";
ALTER TABLE "audit_execution_tasks" RENAME CONSTRAINT "audit_verifier_executions_pkey" TO "audit_execution_tasks_pkey";
ALTER TABLE "audit_execution_tasks" RENAME CONSTRAINT "audit_verifier_executions_auditId_fkey" TO "audit_execution_tasks_auditId_fkey";
ALTER INDEX "audit_verifier_executions_auditId_targetKey_scopeKey_key" RENAME TO "audit_execution_tasks_auditId_targetKey_scopeKey_key";
ALTER INDEX "audit_verifier_executions_auditId_status_idx" RENAME TO "audit_execution_tasks_auditId_status_idx";
ALTER INDEX "audit_verifier_executions_workState_workRetryAt_idx" RENAME TO "audit_execution_tasks_workState_workRetryAt_idx";

CREATE TABLE "audit_verifier_executions" (
  "checkVersion" INTEGER,
  "executionGeneration" INTEGER,
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "targetKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "checkId" TEXT,
  "pageUrl" TEXT,
  "scopeKey" TEXT NOT NULL DEFAULT 'product',
  "status" "VerifierExecutionStatus" NOT NULL,
  "evidenceReference" JSONB,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "taskId" TEXT,
  CONSTRAINT "audit_verifier_executions_pkey" PRIMARY KEY ("id")
);

INSERT INTO "audit_verifier_executions" ("checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt", "taskId")
SELECT receipt."checkVersion", receipt."executionGeneration", receipt."id", receipt."auditId", receipt."targetKey", receipt."source", receipt."checkId", receipt."pageUrl", receipt."scopeKey", receipt."status", receipt."evidenceReference", receipt."detail", receipt."createdAt", receipt."updatedAt", task."id"
FROM "audit_execution_tasks" receipt
LEFT JOIN "audit_execution_tasks" task ON task."id" = receipt."evidenceReference"->>'taskId'
  AND task."auditId" = receipt."auditId" AND task."targetKey" LIKE 'task:%'
WHERE receipt."targetKey" NOT LIKE 'task:%';

DELETE FROM "audit_execution_tasks" WHERE "targetKey" NOT LIKE 'task:%';

CREATE UNIQUE INDEX "audit_execution_tasks_id_auditId_key" ON "audit_execution_tasks"("id", "auditId");
CREATE UNIQUE INDEX "audit_verifier_executions_auditId_targetKey_scopeKey_key" ON "audit_verifier_executions"("auditId", "targetKey", "scopeKey");
CREATE INDEX "audit_verifier_executions_auditId_status_idx" ON "audit_verifier_executions"("auditId", "status");
CREATE INDEX "audit_verifier_executions_taskId_auditId_idx" ON "audit_verifier_executions"("taskId", "auditId");
ALTER TABLE "audit_verifier_executions" ADD CONSTRAINT "audit_verifier_executions_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_verifier_executions" ADD CONSTRAINT "audit_verifier_executions_taskId_auditId_fkey" FOREIGN KEY ("taskId", "auditId") REFERENCES "audit_execution_tasks"("id", "auditId") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE VIEW "audit_execution_evidence" AS
SELECT 'receipt'::TEXT AS "recordKind", NULL::"AuditWorkState" AS "workState", NULL::TEXT AS "workKind", ARRAY[]::TEXT[] AS "workDependencies", NULL::JSONB AS "workInput", NULL::JSONB AS "workResult", NULL::TEXT AS "workToken", NULL::INTEGER AS "workGeneration", NULL::INTEGER AS "workAttempts", NULL::TIMESTAMP(3) AS "workLeaseUntil", NULL::TIMESTAMP(3) AS "workRetryAt", NULL::TIMESTAMP(3) AS "workRecoveryUntil", NULL::TEXT AS "workErrorCode", NULL::"AuditDispatchState" AS "workDispatchState", NULL::TIMESTAMP(3) AS "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt" FROM "audit_verifier_executions"
UNION ALL
SELECT 'task'::TEXT AS "recordKind", "workState", "workKind", "workDependencies", "workInput", "workResult", "workToken", "workGeneration", "workAttempts", "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "workErrorCode", "workDispatchState", "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt" FROM "audit_execution_tasks";

COMMIT;
