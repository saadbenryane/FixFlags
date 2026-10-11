CREATE TYPE "AuditDispatchState" AS ENUM ('PENDING', 'SENT', 'FAILED');
ALTER TABLE "audits"
  ADD COLUMN "executionSpec" JSONB,
  ADD COLUMN "dispatchState" "AuditDispatchState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "dispatchAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dispatchNextAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "dispatchError" TEXT,
  ADD COLUMN "dispatchLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "executionToken" TEXT,
  ADD COLUMN "executionGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "executionLeaseUntil" TIMESTAMP(3);
-- Existing executions keep their established queue/recovery ownership.
UPDATE "audits" SET "dispatchState" = 'SENT';
CREATE INDEX "audits_dispatch_due_idx" ON "audits" ("dispatchState", "dispatchNextAt");
ALTER TABLE "run_requests" ADD COLUMN "executionSpec" JSONB, ADD COLUMN "requestHash" TEXT;
ALTER TABLE "improvement_attempts" ADD COLUMN "idempotencyKey" TEXT, ADD COLUMN "requestHash" TEXT;
CREATE UNIQUE INDEX "improvement_attempts_improvementId_idempotencyKey_key" ON "improvement_attempts" ("improvementId", "idempotencyKey");
ALTER TABLE "outcome_binding_executions" ADD COLUMN "bindingVersion" INTEGER, ADD COLUMN "executionGeneration" INTEGER;
ALTER TABLE "outcome_binding_attempts" ADD COLUMN "bindingVersion" INTEGER, ADD COLUMN "executionGeneration" INTEGER;
ALTER TABLE "audit_verifier_executions" ADD COLUMN "checkVersion" INTEGER, ADD COLUMN "executionGeneration" INTEGER;
