-- Add pipeline observability and recheck mode
CREATE TYPE "RecheckMode" AS ENUM ('FULL', 'SUMMARY_ONLY');

ALTER TABLE "audits" ADD COLUMN "pipelineLog" JSONB;
ALTER TABLE "audits" ADD COLUMN "pipelineVersion" TEXT;
ALTER TABLE "audits" ADD COLUMN "recheckMode" "RecheckMode" NOT NULL DEFAULT 'FULL';
