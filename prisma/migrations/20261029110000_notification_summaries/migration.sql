-- CreateEnum
CREATE TYPE "NotificationSummaryCadence" AS ENUM ('FOLLOW_MONITORING', 'DAILY', 'WEEKLY', 'OFF');

-- CreateEnum
CREATE TYPE "NotificationDigestStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryProjectedAt" TIMESTAMP(3),
ADD COLUMN     "leaseUntil" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "payload" JSONB;

-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "watchDeliveryProjectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "uptime_notifications" ADD COLUMN     "deliveryProjectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "cadence" "NotificationSummaryCadence" NOT NULL DEFAULT 'FOLLOW_MONITORING',
    "productTips" BOOLEAN NOT NULL DEFAULT false,
    "hour" INTEGER NOT NULL DEFAULT 9,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "resolvedCadence" TEXT,
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "notification_digests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "NotificationDigestStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "payload" JSONB,
    "providerId" TEXT,
    "deliveryProjectedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL,
    "firstAttemptAt" TIMESTAMP(3) NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "delayedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("providerId")
);

-- CreateTable
CREATE TABLE "email_provider_events" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipientHashes" TEXT[],
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "bodyHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "recipientHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("recipientHash")
);

-- CreateIndex
CREATE INDEX "notification_preferences_nextSendAt_idx" ON "notification_preferences"("nextSendAt");

-- CreateIndex
CREATE INDEX "notification_digests_status_nextAttemptAt_leaseUntil_idx" ON "notification_digests"("status", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "notification_digests_status_deliveryProjectedAt_sentAt_idx" ON "notification_digests"("status", "deliveryProjectedAt", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_digests_userId_revision_scheduledAt_key" ON "notification_digests"("userId", "revision", "scheduledAt");

-- CreateIndex
CREATE INDEX "email_deliveries_userId_acceptedAt_idx" ON "email_deliveries"("userId", "acceptedAt" DESC);

-- CreateIndex
CREATE INDEX "email_provider_events_providerId_occurredAt_idx" ON "email_provider_events"("providerId", "occurredAt");

-- CreateIndex
CREATE INDEX "email_provider_events_processedAt_receivedAt_idx" ON "email_provider_events"("processedAt", "receivedAt");

-- CreateIndex
CREATE INDEX "email_provider_events_expiresAt_idx" ON "email_provider_events"("expiresAt");

-- CreateIndex
CREATE INDEX "email_logs_status_deliveryProjectedAt_sentAt_idx" ON "email_logs"("status", "deliveryProjectedAt", "sentAt");

-- CreateIndex
CREATE INDEX "audits_watch_delivery_projection_idx" ON "audits"("watchNotificationStatus", "watchDeliveryProjectedAt", "watchNotifiedAt");

-- CreateIndex
CREATE INDEX "uptime_notifications_status_deliveryProjectedAt_sentAt_idx" ON "uptime_notifications"("status", "deliveryProjectedAt", "sentAt");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_digests" ADD CONSTRAINT "notification_digests_preference_fkey" FOREIGN KEY ("userId") REFERENCES "notification_preferences"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

