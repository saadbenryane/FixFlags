-- AlterEnum
ALTER TYPE "AuditSource" ADD VALUE 'REPORT';

-- AlterTable
ALTER TABLE "audits" ADD COLUMN "leadSyncedAt" TIMESTAMP(3);

-- Seed default support tenant (idempotent)
INSERT INTO "support_tenants" ("id", "slug", "name", "isUnlimited", "createdAt", "updatedAt")
VALUES (
  'fixflags-tenant-default',
  'fixflags',
  'FixFlags',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
