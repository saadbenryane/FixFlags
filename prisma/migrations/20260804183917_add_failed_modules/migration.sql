-- Surface failed deterministic check modules on the audit so the report can
-- warn when "all fixes" is partial (G6: silent completeness loss).
ALTER TABLE "audits" ADD COLUMN "failedModules" JSONB;
