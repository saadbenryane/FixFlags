-- Store how far a public Product Review goes, structured open-check outcomes,
-- coverage facts, live progress copy, Flag affected paths, and cost counts.

ALTER TABLE "audits" ADD COLUMN "reviewDepth" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "audits" ADD COLUMN "openCheckResults" JSONB;
ALTER TABLE "audits" ADD COLUMN "reviewCoverage" JSONB;
ALTER TABLE "audits" ADD COLUMN "progressDetail" TEXT;

ALTER TABLE "flags" ADD COLUMN "affectedPaths" JSONB;

ALTER TABLE "audit_run_costs" ADD COLUMN "pagesReviewed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "audit_run_costs" ADD COLUMN "openCheckRequests" INTEGER NOT NULL DEFAULT 0;
