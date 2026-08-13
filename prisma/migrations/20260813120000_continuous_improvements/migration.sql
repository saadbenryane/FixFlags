CREATE TYPE "ImprovementStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'VERIFIED', 'REJECTED', 'SUPERSEDED', 'UNVERIFIED');

CREATE TYPE "ImprovementOccurrenceKind" AS ENUM ('OBSERVED', 'CONFIRMED', 'CLEARED', 'REGRESSED');

CREATE TYPE "VerificationOutcome" AS ENUM ('IMPROVED', 'UNCHANGED', 'REGRESSED', 'INCONCLUSIVE');

CREATE TABLE "improvements" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "judgment" TEXT NOT NULL,
    "expectedBenefit" TEXT NOT NULL,
    "recommendedChange" TEXT NOT NULL,
    "protectedScope" TEXT,
    "successCondition" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ImprovementStatus" NOT NULL DEFAULT 'PROPOSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "improvements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "improvement_occurrences" (
    "id" TEXT NOT NULL,
    "improvementId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "kind" "ImprovementOccurrenceKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "improvement_occurrences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "improvement_attempts" (
    "id" TEXT NOT NULL,
    "improvementId" TEXT NOT NULL,
    "builder" TEXT NOT NULL,
    "handoffReference" TEXT,
    "pullRequestReference" TEXT,
    "deploymentReference" TEXT,
    "changeSummary" TEXT,
    "verificationAuditId" TEXT,
    "outcome" "VerificationOutcome",
    "testedCondition" TEXT,
    "evidenceReference" JSONB,
    "remainingRisk" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "improvement_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "improvements_projectId_fingerprint_key" ON "improvements"("projectId", "fingerprint");
CREATE INDEX "improvements_projectId_status_priority_idx" ON "improvements"("projectId", "status", "priority");
CREATE INDEX "improvements_projectId_updatedAt_idx" ON "improvements"("projectId", "updatedAt" DESC);
CREATE UNIQUE INDEX "improvement_occurrences_flagId_key" ON "improvement_occurrences"("flagId");
CREATE INDEX "improvement_occurrences_improvementId_createdAt_idx" ON "improvement_occurrences"("improvementId", "createdAt");
CREATE INDEX "improvement_occurrences_auditId_idx" ON "improvement_occurrences"("auditId");
CREATE INDEX "improvement_attempts_improvementId_createdAt_idx" ON "improvement_attempts"("improvementId", "createdAt" DESC);
CREATE INDEX "improvement_attempts_verificationAuditId_idx" ON "improvement_attempts"("verificationAuditId");

ALTER TABLE "improvements" ADD CONSTRAINT "improvements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_occurrences" ADD CONSTRAINT "improvement_occurrences_improvementId_fkey" FOREIGN KEY ("improvementId") REFERENCES "improvements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_occurrences" ADD CONSTRAINT "improvement_occurrences_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_occurrences" ADD CONSTRAINT "improvement_occurrences_flagId_fkey" FOREIGN KEY ("flagId") REFERENCES "flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_attempts" ADD CONSTRAINT "improvement_attempts_improvementId_fkey" FOREIGN KEY ("improvementId") REFERENCES "improvements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "improvement_attempts" ADD CONSTRAINT "improvement_attempts_verificationAuditId_fkey" FOREIGN KEY ("verificationAuditId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
