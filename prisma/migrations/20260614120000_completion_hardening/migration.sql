-- CreateEnum
CREATE TYPE "AuditMode" AS ENUM ('SINGLE', 'CRITICAL_PATH');

-- AlterTable
ALTER TABLE "audits" ADD COLUMN "trialMonitoring" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audits" ADD COLUMN "auditMode" "AuditMode" NOT NULL DEFAULT 'SINGLE';
ALTER TABLE "audits" ADD COLUMN "launchReadiness" JSONB;

-- AlterTable
ALTER TABLE "findings" ADD COLUMN "pageUrl" TEXT;
