CREATE TYPE "VerifierExecutionStatus" AS ENUM ('COMPLETED', 'FAILED', 'NOT_APPLICABLE');

CREATE TYPE "ImprovementCycleEventType" AS ENUM (
  'GENERATED',
  'RECOMMENDED',
  'VIEWED',
  'ACCEPTED_EXPLICIT',
  'ACCEPTED_INFERRED',
  'HANDOFF_COPIED',
  'ATTEMPTED',
  'REJECTED',
  'OUTCOME_ISSUED',
  'IMPROVED'
);

CREATE TABLE "audit_verifier_executions" (
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
  CONSTRAINT "audit_verifier_executions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "improvement_cycles" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "improvementId" TEXT NOT NULL,
  "occurrenceId" TEXT,
  "sourceAuditId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "improvement_cycles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "improvement_cycle_events" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "type" "ImprovementCycleEventType" NOT NULL,
  "transport" TEXT NOT NULL,
  "client" TEXT,
  "actor" TEXT,
  "attemptId" TEXT,
  "verificationAuditId" TEXT,
  "outcome" "VerificationOutcome",
  "rejectionReason" "ImprovementRejectionReason",
  "rejectionNote" TEXT,
  "revisitAt" TIMESTAMP(3),
  "contextCorrection" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "improvement_cycle_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_verifier_executions_auditId_targetKey_scopeKey_key"
ON "audit_verifier_executions"("auditId", "targetKey", "scopeKey");
CREATE INDEX "audit_verifier_executions_auditId_status_idx"
ON "audit_verifier_executions"("auditId", "status");

CREATE UNIQUE INDEX "improvement_cycles_improvementId_sourceAuditId_key"
ON "improvement_cycles"("improvementId", "sourceAuditId");
CREATE INDEX "improvement_cycles_projectId_createdAt_idx"
ON "improvement_cycles"("projectId", "createdAt" DESC);
CREATE INDEX "improvement_cycles_sourceAuditId_idx"
ON "improvement_cycles"("sourceAuditId");

CREATE UNIQUE INDEX "improvement_cycle_events_cycleId_idempotencyKey_key"
ON "improvement_cycle_events"("cycleId", "idempotencyKey");
CREATE INDEX "improvement_cycle_events_type_occurredAt_idx"
ON "improvement_cycle_events"("type", "occurredAt");
CREATE INDEX "improvement_cycle_events_verificationAuditId_idx"
ON "improvement_cycle_events"("verificationAuditId");
CREATE INDEX "improvement_cycle_events_rejectionReason_idx"
ON "improvement_cycle_events"("rejectionReason");

ALTER TABLE "audit_verifier_executions"
ADD CONSTRAINT "audit_verifier_executions_auditId_fkey"
FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "improvement_cycles"
ADD CONSTRAINT "improvement_cycles_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_cycles"
ADD CONSTRAINT "improvement_cycles_improvementId_fkey"
FOREIGN KEY ("improvementId") REFERENCES "improvements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_cycles"
ADD CONSTRAINT "improvement_cycles_occurrenceId_fkey"
FOREIGN KEY ("occurrenceId") REFERENCES "improvement_occurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "improvement_cycles"
ADD CONSTRAINT "improvement_cycles_sourceAuditId_fkey"
FOREIGN KEY ("sourceAuditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "improvement_cycle_events"
ADD CONSTRAINT "improvement_cycle_events_cycleId_fkey"
FOREIGN KEY ("cycleId") REFERENCES "improvement_cycles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_cycle_events"
ADD CONSTRAINT "improvement_cycle_events_attemptId_fkey"
FOREIGN KEY ("attemptId") REFERENCES "improvement_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

