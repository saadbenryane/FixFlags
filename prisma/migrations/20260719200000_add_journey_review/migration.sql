-- AlterEnum
ALTER TYPE "FlagSource" ADD VALUE 'JOURNEY';

-- CreateEnum
CREATE TYPE "JourneyReviewStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'ABANDONED', 'FAILED');

-- AlterTable
ALTER TABLE "audits" ADD COLUMN "journeyReviewIncluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audits" ADD COLUMN "journeyReviewAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "journey_reviews" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "journeyType" TEXT NOT NULL,
    "startUrl" TEXT NOT NULL,
    "status" "JourneyReviewStatus" NOT NULL DEFAULT 'QUEUED',
    "completedSteps" INTEGER NOT NULL DEFAULT 0,
    "maxSteps" INTEGER NOT NULL DEFAULT 10,
    "goalAchieved" BOOLEAN,
    "blockedReason" TEXT,
    "abandonedReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "plannerInputTokens" INTEGER NOT NULL DEFAULT 0,
    "plannerOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "plannerModel" TEXT,
    "evaluatorInputTokens" INTEGER NOT NULL DEFAULT 0,
    "evaluatorOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "evaluatorModel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journey_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_steps" (
    "id" TEXT NOT NULL,
    "journeyReviewId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "actionDetail" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "screenshotBeforeUrl" TEXT,
    "screenshotAfterUrl" TEXT,
    "accessibilityTree" TEXT NOT NULL,
    "consoleErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "networkErrors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "loadTimeMs" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journey_findings" (
    "id" TEXT NOT NULL,
    "journeyReviewId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "rubric" "RubricName" NOT NULL,
    "severity" "Severity" NOT NULL,
    "impactTag" "ImpactTag" NOT NULL,
    "problem" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "fix" TEXT,
    "screenshotUrl" TEXT,
    "accessibilityEvidence" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "reproducibility" TEXT NOT NULL DEFAULT 'always',
    "flagId" TEXT,
    "checkId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journey_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journey_reviews_auditId_idx" ON "journey_reviews"("auditId");
CREATE INDEX "journey_reviews_status_idx" ON "journey_reviews"("status");
CREATE INDEX "journey_reviews_journeyType_idx" ON "journey_reviews"("journeyType");
CREATE INDEX "journey_steps_journeyReviewId_idx" ON "journey_steps"("journeyReviewId");
CREATE UNIQUE INDEX "journey_steps_journeyReviewId_stepNumber_key" ON "journey_steps"("journeyReviewId", "stepNumber");
CREATE INDEX "journey_findings_journeyReviewId_idx" ON "journey_findings"("journeyReviewId");
CREATE INDEX "journey_findings_rubric_idx" ON "journey_findings"("rubric");
CREATE INDEX "journey_findings_severity_idx" ON "journey_findings"("severity");
CREATE INDEX "journey_findings_flagId_idx" ON "journey_findings"("flagId");

-- AddForeignKey
ALTER TABLE "journey_reviews" ADD CONSTRAINT "journey_reviews_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_steps" ADD CONSTRAINT "journey_steps_journeyReviewId_fkey" FOREIGN KEY ("journeyReviewId") REFERENCES "journey_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journey_findings" ADD CONSTRAINT "journey_findings_journeyReviewId_fkey" FOREIGN KEY ("journeyReviewId") REFERENCES "journey_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
