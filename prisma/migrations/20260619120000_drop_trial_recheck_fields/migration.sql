-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "freeRecheckUsedAt";

-- AlterTable
ALTER TABLE "audits" DROP COLUMN IF EXISTS "trialRecheck";
