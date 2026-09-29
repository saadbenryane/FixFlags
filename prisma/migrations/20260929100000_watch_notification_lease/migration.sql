-- Reclaimable lease for the Watch notification delivery claim.
--
-- A worker claims an alert by writing SENDING, then calls the email provider.
-- If the worker dies between those two steps, the row stays SENDING forever:
-- the retry sweep only selects PENDING and FAILED, so the customer is never told
-- their Site regressed. That is the worst outcome for a product whose promise is
-- watching while unattended, and it is invisible because nothing reports it.
--
-- A lease makes the claim recoverable. A SENDING row is retryable once its lease
-- has expired, which bounds the wait to one lease rather than losing the alert.
-- The lease is cleared on every terminal outcome, so a delivered or failed alert
-- never looks in flight.
--
-- Additive only: a nullable column and a new index, both safe to apply online.
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "watchNotificationLeaseUntil" TIMESTAMP(3);

-- Supports the retry sweep, which scans undelivered Watch alerts by status and
-- age. The name is Prisma's own truncated form for
-- @@index([watchNotificationStatus, updatedAt]) so Postgres cannot silently
-- rename it and leave the schema in permanent drift.
CREATE INDEX IF NOT EXISTS "audits_watchNotificationStatus_updatedAt_idx"
    ON "audits"("watchNotificationStatus", "updatedAt");
