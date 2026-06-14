-- Lifecycle and evidence enums
ALTER TYPE "AuditStatus" ADD VALUE IF NOT EXISTS 'FINALIZING' BEFORE 'COMPLETED';

CREATE TYPE "AuditPageStatus" AS ENUM (
  'QUEUED',
  'CAPTURING',
  'CHECKING',
  'JUDGING',
  'COMPLETED',
  'PARTIAL',
  'FAILED'
);
CREATE TYPE "ReportCompleteness" AS ENUM ('FULL', 'PARTIAL', 'UNKNOWN');
CREATE TYPE "AssessmentState" AS ENUM ('ASSESSED', 'PARTIAL', 'UNKNOWN');
CREATE TYPE "LaunchReadinessState" AS ENUM ('SAFE', 'FIX_FIRST', 'NOT_READY', 'UNKNOWN');
CREATE TYPE "SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID');
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

ALTER TYPE "ExpertReviewStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW' BEFORE 'FULFILLED';
ALTER TYPE "ExpertReviewStatus" ADD VALUE IF NOT EXISTS 'DELIVERED' BEFORE 'FULFILLED';

-- Explicit subscription and delivery state
ALTER TABLE "users"
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'NONE';

UPDATE "users"
SET "subscriptionStatus" = CASE
  WHEN "stripeSubscriptionId" IS NOT NULL THEN 'ACTIVE'::"SubscriptionStatus"
  ELSE 'NONE'::"SubscriptionStatus"
END;

ALTER TABLE "email_logs"
  ADD COLUMN "providerId" TEXT,
  ADD COLUMN "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "errorMsg" TEXT;

UPDATE "email_logs" SET "status" = 'SENT';

-- Hash all existing API keys before removing plaintext.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE "api_keys"
  ADD COLUMN "keyHash" TEXT,
  ADD COLUMN "prefix" TEXT,
  ADD COLUMN "lastFour" TEXT,
  ADD COLUMN "revokedAt" TIMESTAMP(3);

UPDATE "api_keys"
SET
  "keyHash" = encode(digest("key", 'sha256'), 'hex'),
  "prefix" = left("key", 13),
  "lastFour" = right("key", 4);

ALTER TABLE "api_keys"
  ALTER COLUMN "keyHash" SET NOT NULL,
  ALTER COLUMN "prefix" SET NOT NULL,
  ALTER COLUMN "lastFour" SET NOT NULL;

DROP INDEX IF EXISTS "api_keys_key_key";
ALTER TABLE "api_keys" DROP COLUMN "key";
CREATE UNIQUE INDEX "api_keys_keyHash_key" ON "api_keys"("keyHash");

-- Monitoring is not a shipped product capability.
ALTER TABLE "projects" DROP COLUMN IF EXISTS "monitoringEnabled";

-- Honest completeness and operational failure metadata.
ALTER TABLE "audits"
  ADD COLUMN "launchReadinessState" "LaunchReadinessState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "reportCompleteness" "ReportCompleteness" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "evidenceCoverage" JSONB,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "failureCode" TEXT,
  ADD COLUMN "failureStage" TEXT,
  ADD COLUMN "failureMetadata" JSONB;

UPDATE "audits"
SET
  "launchReadinessState" = CASE lower(COALESCE("launchReadiness"->>'readiness', ''))
    WHEN 'safe' THEN 'SAFE'::"LaunchReadinessState"
    WHEN 'fix_first' THEN 'FIX_FIRST'::"LaunchReadinessState"
    WHEN 'not_ready' THEN 'NOT_READY'::"LaunchReadinessState"
    ELSE 'UNKNOWN'::"LaunchReadinessState"
  END,
  "reportCompleteness" = CASE
    WHEN "status" = 'COMPLETED' THEN 'UNKNOWN'::"ReportCompleteness"
    ELSE 'UNKNOWN'::"ReportCompleteness"
  END;

ALTER TABLE "audit_areas"
  ALTER COLUMN "grade" DROP NOT NULL,
  ALTER COLUMN "status" DROP NOT NULL,
  ADD COLUMN "assessmentState" "AssessmentState" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "confidence" DOUBLE PRECISION;

UPDATE "audit_areas"
SET "assessmentState" = CASE
  WHEN "score" IS NULL THEN 'PARTIAL'::"AssessmentState"
  ELSE 'ASSESSED'::"AssessmentState"
END;

-- Per-page critical path evidence.
CREATE TABLE "audit_pages" (
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "normalizedUrl" TEXT NOT NULL,
  "title" TEXT,
  "role" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "status" "AuditPageStatus" NOT NULL DEFAULT 'QUEUED',
  "completeness" "ReportCompleteness" NOT NULL DEFAULT 'UNKNOWN',
  "htmlMetadata" JSONB,
  "performanceData" JSONB,
  "consoleErrors" JSONB,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "audit_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_pages_auditId_normalizedUrl_key" ON "audit_pages"("auditId", "normalizedUrl");
CREATE UNIQUE INDEX "audit_pages_auditId_position_key" ON "audit_pages"("auditId", "position");
CREATE INDEX "audit_pages_auditId_status_idx" ON "audit_pages"("auditId", "status");
ALTER TABLE "audit_pages"
  ADD CONSTRAINT "audit_pages_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "screenshots" ADD COLUMN "pageId" TEXT;
CREATE INDEX "screenshots_pageId_idx" ON "screenshots"("pageId");
ALTER TABLE "screenshots"
  ADD CONSTRAINT "screenshots_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "audit_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "findings"
  ADD COLUMN "pageId" TEXT,
  ADD COLUMN "fingerprint" TEXT;
CREATE INDEX "findings_pageId_idx" ON "findings"("pageId");
CREATE INDEX "findings_auditId_fingerprint_idx" ON "findings"("auditId", "fingerprint");
ALTER TABLE "findings"
  ADD CONSTRAINT "findings_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "audit_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replay-safe Stripe webhooks.
CREATE TABLE "processed_stripe_events" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadHash" TEXT,
  CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

-- Expert Review must contain a deliverable and auditable status history.
CREATE TABLE "expert_review_deliverables" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "priorities" JSONB NOT NULL,
  "reportUrl" TEXT,
  "authoredBy" TEXT NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "expert_review_deliverables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "expert_review_deliverables_orderId_key" ON "expert_review_deliverables"("orderId");
ALTER TABLE "expert_review_deliverables"
  ADD CONSTRAINT "expert_review_deliverables_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "expert_review_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "expert_review_events" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expert_review_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expert_review_events_orderId_createdAt_idx" ON "expert_review_events"("orderId", "createdAt");
ALTER TABLE "expert_review_events"
  ADD CONSTRAINT "expert_review_events_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "expert_review_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expert_review_events"
  ADD CONSTRAINT "expert_review_events_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
