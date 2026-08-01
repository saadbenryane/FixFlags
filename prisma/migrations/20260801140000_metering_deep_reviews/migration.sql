-- Dual-pool metering: deep review counters on users; idempotent deep usage on audits.
ALTER TABLE "users" ADD COLUMN "deepReviewsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "deepReviewsLimit" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "audits" ADD COLUMN "deepReviewUsageCountedAt" TIMESTAMP(3);
