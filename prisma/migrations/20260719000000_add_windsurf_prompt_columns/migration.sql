-- Add missing windsurfPrompt column to report_rubrics and flags tables
-- (present in Prisma schema but never migrated)

ALTER TABLE "report_rubrics" ADD COLUMN "windsurfPrompt" TEXT;

ALTER TABLE "flags" ADD COLUMN "windsurfPrompt" TEXT;
