CREATE TYPE "AuditWorkState" AS ENUM ('WAITING', 'READY', 'RUNNING', 'RETRY_WAIT', 'COMPLETED', 'BLOCKED', 'EXHAUSTED');
ALTER TYPE "VerifierExecutionStatus" ADD VALUE 'PENDING';
ALTER TYPE "VerifierExecutionStatus" ADD VALUE 'RUNNING';
ALTER TABLE "audits" ADD COLUMN "recoveryUntil" TIMESTAMP(3);
ALTER TABLE "audit_pipeline_events" ADD COLUMN "sequence" BIGSERIAL NOT NULL;
CREATE UNIQUE INDEX "audit_pipeline_events_sequence_key" ON "audit_pipeline_events" ("sequence");
ALTER TABLE "audit_verifier_executions"
  ADD COLUMN "workState" "AuditWorkState",
  ADD COLUMN "workKind" TEXT,
  ADD COLUMN "workDependencies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "workInput" JSONB,
  ADD COLUMN "workResult" JSONB,
  ADD COLUMN "workToken" TEXT,
  ADD COLUMN "workGeneration" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workLeaseUntil" TIMESTAMP(3),
  ADD COLUMN "workRetryAt" TIMESTAMP(3),
  ADD COLUMN "workRecoveryUntil" TIMESTAMP(3),
  ADD COLUMN "workErrorCode" TEXT,
  ADD COLUMN "workDispatchState" "AuditDispatchState",
  ADD COLUMN "workDispatchLeaseUntil" TIMESTAMP(3);
CREATE INDEX "audit_verifier_executions_workState_workRetryAt_idx" ON "audit_verifier_executions" ("workState", "workRetryAt");
