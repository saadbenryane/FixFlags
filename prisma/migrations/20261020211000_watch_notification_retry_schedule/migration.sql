-- Each alert owns its backoff. Null preserves immediate eligibility for historical rows.
ALTER TABLE "audits" ADD COLUMN "watchNotificationNextAttemptAt" TIMESTAMP(3);

CREATE INDEX "audits_watch_notification_due_idx"
  ON "audits"("watchNotificationStatus", "watchNotificationNextAttemptAt", "updatedAt");
DROP INDEX "audits_watchNotificationStatus_updatedAt_idx";
