-- Add pipeline observability and monitoring mode
CREATE TYPE "MonitoringMode" AS ENUM ('FULL', 'SUMMARY_ONLY');

ALTER TABLE "audits" ADD COLUMN "pipelineLog" JSONB;
ALTER TABLE "audits" ADD COLUMN "pipelineVersion" TEXT;
ALTER TABLE "audits" ADD COLUMN "monitoringMode" "MonitoringMode" NOT NULL DEFAULT 'FULL';
