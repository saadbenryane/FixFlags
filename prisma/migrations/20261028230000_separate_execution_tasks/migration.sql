BEGIN;

CREATE TABLE "audit_execution_tasks" (
  "workState" "AuditWorkState",
  "workKind" TEXT,
  "workDependencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workInput" JSONB,
  "workResult" JSONB,
  "workToken" TEXT,
  "workGeneration" INTEGER NOT NULL DEFAULT 0,
  "workAttempts" INTEGER NOT NULL DEFAULT 0,
  "workLeaseUntil" TIMESTAMP(3),
  "workRetryAt" TIMESTAMP(3),
  "workRecoveryUntil" TIMESTAMP(3),
  "workErrorCode" TEXT,
  "workDispatchState" "AuditDispatchState",
  "workDispatchLeaseUntil" TIMESTAMP(3),
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
  CONSTRAINT "audit_execution_tasks_pkey" PRIMARY KEY ("id")
);

INSERT INTO "audit_execution_tasks" ("workState", "workKind", "workDependencies", "workInput", "workResult", "workToken", "workGeneration", "workAttempts", "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "workErrorCode", "workDispatchState", "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt")
SELECT "workState", "workKind", "workDependencies", "workInput", "workResult", "workToken", "workGeneration", "workAttempts", "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "workErrorCode", "workDispatchState", "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt" FROM "audit_verifier_executions" WHERE "targetKey" LIKE 'task:%';

ALTER TABLE "audit_verifier_executions" ADD COLUMN "taskId" TEXT;

UPDATE "audit_verifier_executions" receipt SET "taskId" = task.id
FROM "audit_execution_tasks" task
WHERE receipt."evidenceReference"->>'taskId' = task.id AND receipt."auditId" = task."auditId"
  AND receipt."targetKey" NOT LIKE 'task:%';

DELETE FROM "audit_verifier_executions" WHERE "targetKey" LIKE 'task:%';

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workState";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workKind";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workDependencies";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workInput";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workResult";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workToken";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workGeneration";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workAttempts";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workLeaseUntil";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workRetryAt";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workRecoveryUntil";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workErrorCode";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workDispatchState";

ALTER TABLE "audit_verifier_executions" DROP COLUMN "workDispatchLeaseUntil";

CREATE UNIQUE INDEX "audit_execution_tasks_auditId_targetKey_scopeKey_key" ON "audit_execution_tasks"("auditId", "targetKey", "scopeKey");
CREATE UNIQUE INDEX "audit_execution_tasks_id_auditId_key" ON "audit_execution_tasks"("id", "auditId");
CREATE INDEX "audit_execution_tasks_auditId_status_idx" ON "audit_execution_tasks"("auditId", "status");
CREATE INDEX "audit_execution_tasks_workState_workRetryAt_idx" ON "audit_execution_tasks"("workState", "workRetryAt");
CREATE INDEX "audit_verifier_executions_taskId_auditId_idx" ON "audit_verifier_executions"("taskId", "auditId");
ALTER TABLE "audit_execution_tasks" ADD CONSTRAINT "audit_execution_tasks_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_verifier_executions" ADD CONSTRAINT "audit_verifier_executions_taskId_auditId_fkey" FOREIGN KEY ("taskId", "auditId") REFERENCES "audit_execution_tasks"("id", "auditId") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE VIEW "audit_execution_evidence" AS
SELECT 'receipt'::TEXT AS "recordKind", NULL::"AuditWorkState" AS "workState", NULL::TEXT AS "workKind", ARRAY[]::TEXT[] AS "workDependencies", NULL::JSONB AS "workInput", NULL::JSONB AS "workResult", NULL::TEXT AS "workToken", NULL::INTEGER AS "workGeneration", NULL::INTEGER AS "workAttempts", NULL::TIMESTAMP(3) AS "workLeaseUntil", NULL::TIMESTAMP(3) AS "workRetryAt", NULL::TIMESTAMP(3) AS "workRecoveryUntil", NULL::TEXT AS "workErrorCode", NULL::"AuditDispatchState" AS "workDispatchState", NULL::TIMESTAMP(3) AS "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt" FROM "audit_verifier_executions"
UNION ALL
SELECT 'task'::TEXT AS "recordKind", "workState", "workKind", "workDependencies", "workInput", "workResult", "workToken", "workGeneration", "workAttempts", "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "workErrorCode", "workDispatchState", "workDispatchLeaseUntil", "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail", "createdAt", "updatedAt" FROM "audit_execution_tasks";

COMMIT;
