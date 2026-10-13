-- CreateEnum
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETING');

-- CreateEnum
CREATE TYPE "CostPricingBasis" AS ENUM ('LEGACY_ESTIMATE', 'CONFIGURED_ESTIMATE', 'UNPRICED');

-- CreateEnum
CREATE TYPE "AdminOperationStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'INDETERMINATE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lifecycleRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifecycleStatus" "AccountLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "support_sessions" ADD COLUMN     "agentReadThrough" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "nextMessageSequence" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "visitorReadThrough" BIGINT NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "support_messages" ADD COLUMN     "requestKey" TEXT,
ADD COLUMN     "sequence" BIGINT;

-- AlterTable
ALTER TABLE "audit_run_costs" ADD COLUMN     "planAtRun" "Plan",
ADD COLUMN     "pricingBasis" "CostPricingBasis" NOT NULL DEFAULT 'LEGACY_ESTIMATE',
ALTER COLUMN "llmCostUsd" DROP NOT NULL,
ALTER COLUMN "estimatedCostUsd" DROP NOT NULL,
ALTER COLUMN "triageCostUsd" DROP NOT NULL,
ALTER COLUMN "prescriptionCostUsd" DROP NOT NULL;

-- CreateTable
CREATE TABLE "admin_operations" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorSessionId" TEXT NOT NULL,
    "actorAuthenticatedAt" TIMESTAMP(3) NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ownerId" TEXT,
    "reason" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "expectedRevision" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "intentExpiresAt" TIMESTAMP(3) NOT NULL,
    "status" "AdminOperationStatus" NOT NULL DEFAULT 'QUEUED',
    "result" JSONB,
    "providerReference" TEXT,
    "executionToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "admin_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_activity_events" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_evidence_grants" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_evidence_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "plan" "Plan",
    "siteAllowance" INTEGER,
    "scanAllowance" INTEGER,
    "deepReviewAllowance" INTEGER,
    "allowedWatchIntervals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_ledger_entries" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT,
    "subscriptionId" TEXT,
    "paymentReference" TEXT,
    "planAtPayment" "Plan",
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_drafts" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_drafts_pkey" PRIMARY KEY ("id")
);


WITH ordered AS (
  SELECT "id", row_number() OVER (PARTITION BY "sessionId" ORDER BY "createdAt", "id") AS position
  FROM "support_messages"
)
UPDATE "support_messages" SET "sequence" = ordered.position FROM ordered WHERE "support_messages"."id" = ordered."id";
UPDATE "support_sessions" s SET "nextMessageSequence" = COALESCE((SELECT max(m."sequence") FROM "support_messages" m WHERE m."sessionId" = s."id"), 0);
ALTER TABLE "support_messages" ALTER COLUMN "sequence" SET NOT NULL;

-- CreateIndex
CREATE INDEX "admin_operations_status_leaseUntil_createdAt_idx" ON "admin_operations"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE INDEX "admin_operations_targetType_targetId_createdAt_idx" ON "admin_operations"("targetType", "targetId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "admin_operations_actorId_createdAt_idx" ON "admin_operations"("actorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_operations_actorId_idempotencyKey_key" ON "admin_operations"("actorId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "admin_activity_events_sequence_key" ON "admin_activity_events"("sequence");

-- CreateIndex
CREATE INDEX "admin_activity_events_occurredAt_id_idx" ON "admin_activity_events"("occurredAt" DESC, "id");

-- CreateIndex
CREATE INDEX "admin_activity_events_targetType_targetId_occurredAt_idx" ON "admin_activity_events"("targetType", "targetId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "admin_evidence_grants_operationId_key" ON "admin_evidence_grants"("operationId");

-- CreateIndex
CREATE INDEX "admin_evidence_grants_actorId_sessionId_auditId_expiresAt_idx" ON "admin_evidence_grants"("actorId", "sessionId", "auditId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "entitlement_grants_operationId_key" ON "entitlement_grants"("operationId");

-- CreateIndex
CREATE INDEX "entitlement_grants_userId_revokedAt_expiresAt_idx" ON "entitlement_grants"("userId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_occurredAt_status_currency_idx" ON "billing_ledger_entries"("occurredAt", "status", "currency");

-- CreateIndex
CREATE INDEX "billing_ledger_entries_userId_occurredAt_idx" ON "billing_ledger_entries"("userId", "occurredAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "billing_ledger_entries_kind_providerId_key" ON "billing_ledger_entries"("kind", "providerId");

-- CreateIndex
CREATE INDEX "support_drafts_updatedAt_idx" ON "support_drafts"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "support_drafts_actorId_sessionId_key" ON "support_drafts"("actorId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_sessionId_sequence_key" ON "support_messages"("sessionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "support_messages_sessionId_senderId_requestKey_key" ON "support_messages"("sessionId", "senderId", "requestKey");

-- AddForeignKey
ALTER TABLE "admin_activity_events" ADD CONSTRAINT "admin_activity_events_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "admin_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_evidence_grants" ADD CONSTRAINT "admin_evidence_grants_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "admin_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_drafts" ADD CONSTRAINT "support_drafts_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "support_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE FUNCTION fixflags_admin_activity_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Admin activity events are append-only';
END;
$$;
CREATE TRIGGER admin_activity_append_only BEFORE UPDATE OR DELETE ON "admin_activity_events"
FOR EACH ROW EXECUTE FUNCTION fixflags_admin_activity_append_only();
