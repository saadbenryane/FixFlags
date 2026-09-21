CREATE TYPE "SiteOutcomeKind" AS ENUM ('GENERIC', 'CHECKOUT');
CREATE TYPE "OutcomeExecutionMechanism" AS ENUM ('BROWSER_JOURNEY');
CREATE TYPE "RunRequestSource" AS ENUM ('WEB', 'WATCH', 'MCP', 'API', 'INTERNAL');
CREATE TYPE "RunRequestStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "OutcomeAssessmentState" AS ENUM ('CLEAR', 'FLAG', 'COULD_NOT_VERIFY');

ALTER TABLE "site_outcomes"
  ADD COLUMN "kind" "SiteOutcomeKind" NOT NULL DEFAULT 'GENERIC',
  ADD COLUMN "expectation" TEXT,
  ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "staleAfterMinutes" INTEGER NOT NULL DEFAULT 11520;

ALTER TABLE "improvements" ADD COLUMN "outcomeId" TEXT;

CREATE TABLE "outcome_execution_bindings" (
  "id" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "mechanism" "OutcomeExecutionMechanism" NOT NULL,
  "key" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outcome_execution_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "run_requests" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "source" "RunRequestSource" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "environment" TEXT NOT NULL DEFAULT 'production',
  "context" JSONB,
  "status" "RunRequestStatus" NOT NULL DEFAULT 'QUEUED',
  "auditId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "run_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outcome_assessments" (
  "id" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "runRequestId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "improvementId" TEXT,
  "state" "OutcomeAssessmentState" NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence" JSONB,
  "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outcome_assessments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outcome_execution_bindings_outcomeId_key_key" ON "outcome_execution_bindings"("outcomeId", "key");
CREATE INDEX "outcome_execution_bindings_outcomeId_enabled_idx" ON "outcome_execution_bindings"("outcomeId", "enabled");
CREATE UNIQUE INDEX "run_requests_idempotencyKey_key" ON "run_requests"("idempotencyKey");
CREATE INDEX "run_requests_projectId_requestedAt_idx" ON "run_requests"("projectId", "requestedAt" DESC);
CREATE INDEX "run_requests_outcomeId_requestedAt_idx" ON "run_requests"("outcomeId", "requestedAt" DESC);
CREATE INDEX "run_requests_auditId_idx" ON "run_requests"("auditId");
CREATE INDEX "run_requests_status_requestedAt_idx" ON "run_requests"("status", "requestedAt");
CREATE UNIQUE INDEX "outcome_assessments_runRequestId_key" ON "outcome_assessments"("runRequestId");
CREATE INDEX "outcome_assessments_outcomeId_assessedAt_idx" ON "outcome_assessments"("outcomeId", "assessedAt" DESC);
CREATE INDEX "outcome_assessments_auditId_idx" ON "outcome_assessments"("auditId");
CREATE INDEX "outcome_assessments_improvementId_idx" ON "outcome_assessments"("improvementId");
CREATE INDEX "improvements_outcomeId_updatedAt_idx" ON "improvements"("outcomeId", "updatedAt" DESC);

ALTER TABLE "improvements" ADD CONSTRAINT "improvements_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outcome_execution_bindings" ADD CONSTRAINT "outcome_execution_bindings_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_requests" ADD CONSTRAINT "run_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_requests" ADD CONSTRAINT "run_requests_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_requests" ADD CONSTRAINT "run_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "run_requests" ADD CONSTRAINT "run_requests_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outcome_assessments" ADD CONSTRAINT "outcome_assessments_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_assessments" ADD CONSTRAINT "outcome_assessments_runRequestId_fkey" FOREIGN KEY ("runRequestId") REFERENCES "run_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_assessments" ADD CONSTRAINT "outcome_assessments_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_assessments" ADD CONSTRAINT "outcome_assessments_improvementId_fkey" FOREIGN KEY ("improvementId") REFERENCES "improvements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
