-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "skipUsageCount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freeMonitoringUsedAt" TIMESTAMP(3);
