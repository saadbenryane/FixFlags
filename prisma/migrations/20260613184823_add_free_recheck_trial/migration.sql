-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "skipUsageCount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "freeRecheckUsedAt" TIMESTAMP(3);
