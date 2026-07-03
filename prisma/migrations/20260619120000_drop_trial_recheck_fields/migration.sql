-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "freeMonitoringUsedAt";

-- AlterTable
ALTER TABLE "audits" DROP COLUMN IF EXISTS "trialMonitoring";
