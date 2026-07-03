-- Rename RecheckMode enum to MonitoringMode
ALTER TYPE "RecheckMode" RENAME TO "MonitoringMode";

-- Rename recheckMode column to monitoringMode
ALTER TABLE "audits" RENAME COLUMN "recheckMode" TO "monitoringMode";
