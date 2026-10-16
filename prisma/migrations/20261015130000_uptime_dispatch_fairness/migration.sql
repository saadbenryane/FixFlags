ALTER TABLE "uptime_monitors" ADD COLUMN "lastDispatchAttemptAt" TIMESTAMP(3);

CREATE INDEX "uptime_monitors_lastDispatchAttemptAt_nextProbeAt_id_idx" ON "uptime_monitors"("lastDispatchAttemptAt", "nextProbeAt", "id");
