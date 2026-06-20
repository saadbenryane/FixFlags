-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'REPORT';

-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "leadSyncedAt" TIMESTAMP(3);
