-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ImpactTag" ADD VALUE IF NOT EXISTS 'CLARITY';
ALTER TYPE "ImpactTag" ADD VALUE IF NOT EXISTS 'AUTHORITY';
ALTER TYPE "ImpactTag" ADD VALUE IF NOT EXISTS 'FRICTION';
ALTER TYPE "ImpactTag" ADD VALUE IF NOT EXISTS 'EMOTION';

-- AlterTable
ALTER TABLE "audits" ALTER COLUMN "auditMode" SET DEFAULT 'CRITICAL_PATH';
