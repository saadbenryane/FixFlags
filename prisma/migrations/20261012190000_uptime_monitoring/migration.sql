-- AlterTable
ALTER TABLE "screenshots" ADD COLUMN "recordedAt" TIMESTAMP(3);
-- Legacy images retain an unknown recording time. Only new rows get a timestamp.
ALTER TABLE "screenshots" ALTER COLUMN "recordedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "uptime_monitors" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "state" TEXT NOT NULL DEFAULT 'unknown',
    "nextProbeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "lastScheduledAt" TIMESTAMP(3),
    "pendingFailureAt" TIMESTAMP(3),
    "pendingSlotAt" TIMESTAMP(3),
    "confirmationDueAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "leaseToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "uptime_monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uptime_probes" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "attempt" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "statusCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "finalUrl" TEXT,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "uptime_probes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uptime_incidents" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "recoveredAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,

    CONSTRAINT "uptime_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uptime_notifications" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uptime_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uptime_monitors_projectId_key" ON "uptime_monitors"("projectId");

-- CreateIndex
CREATE INDEX "uptime_monitors_nextProbeAt_leaseUntil_idx" ON "uptime_monitors"("nextProbeAt", "leaseUntil");

-- CreateIndex
CREATE INDEX "uptime_monitors_confirmationDueAt_idx" ON "uptime_monitors"("confirmationDueAt");

-- CreateIndex
CREATE INDEX "uptime_probes_monitorId_version_observedAt_id_idx" ON "uptime_probes"("monitorId", "version", "observedAt" DESC, "id");

-- CreateIndex
CREATE INDEX "uptime_probes_observedAt_idx" ON "uptime_probes"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "uptime_probes_monitorId_version_scheduledAt_attempt_key" ON "uptime_probes"("monitorId", "version", "scheduledAt", "attempt");

-- CreateIndex
CREATE INDEX "uptime_incidents_monitorId_confirmedAt_idx" ON "uptime_incidents"("monitorId", "confirmedAt" DESC);

-- CreateIndex
CREATE INDEX "uptime_notifications_status_nextAttemptAt_leaseUntil_idx" ON "uptime_notifications"("status", "nextAttemptAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "uptime_notifications_incidentId_kind_key" ON "uptime_notifications"("incidentId", "kind");

-- AddForeignKey
ALTER TABLE "uptime_monitors" ADD CONSTRAINT "uptime_monitors_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uptime_probes" ADD CONSTRAINT "uptime_probes_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "uptime_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uptime_incidents" ADD CONSTRAINT "uptime_incidents_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "uptime_monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uptime_notifications" ADD CONSTRAINT "uptime_notifications_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "uptime_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
