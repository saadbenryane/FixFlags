-- This migration duplicates changes already made in
-- 20260616220000_leads_support_completion (the 'REPORT' AuditSource value and
-- the audits.leadSyncedAt column). It was committed by accident. The statements
-- are guarded with IF NOT EXISTS so the full migration history applies cleanly
-- on a fresh database (where the prior migration already added them) instead of
-- failing with "enum label REPORT already exists", while remaining a no-op on
-- databases that already recorded it.

-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE IF NOT EXISTS 'REPORT';

-- AlterTable
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "leadSyncedAt" TIMESTAMP(3);
