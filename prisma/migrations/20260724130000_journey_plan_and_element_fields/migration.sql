-- AlterTable
ALTER TABLE "journey_reviews" ADD COLUMN IF NOT EXISTS "planJson" JSONB;

-- AlterTable
ALTER TABLE "journey_steps" ADD COLUMN IF NOT EXISTS "elementRef" TEXT;
ALTER TABLE "journey_steps" ADD COLUMN IF NOT EXISTS "elementDescription" TEXT;
ALTER TABLE "journey_steps" ADD COLUMN IF NOT EXISTS "outcomeMatch" BOOLEAN;
ALTER TABLE "journey_steps" ADD COLUMN IF NOT EXISTS "outcomeDetail" TEXT;

-- AlterTable
ALTER TABLE "journey_findings" ADD COLUMN IF NOT EXISTS "findingType" TEXT;
