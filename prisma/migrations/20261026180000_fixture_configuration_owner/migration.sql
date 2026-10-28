-- Preserve configured fixtures under their current ownership baseline.
-- This does not reconstruct who supplied historical secrets or consent.
ALTER TABLE "outcome_fixtures" ADD COLUMN "configuredByUserId" TEXT;

UPDATE "outcome_fixtures" f SET "configuredByUserId" = p."userId"
FROM "projects" p WHERE p.id = f."projectId";

CREATE INDEX "outcome_fixtures_configuredByUserId_idx"
ON "outcome_fixtures"("configuredByUserId");

ALTER TABLE "outcome_fixtures"
ADD CONSTRAINT "outcome_fixtures_configuredByUserId_fkey"
FOREIGN KEY ("configuredByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- Reconciliation selects only this fixture's unsettled operations, then finds
-- their exact receipts without scanning unrelated page observation history.
CREATE INDEX "pipeline_fixture_submission_idx"
ON "audit_pipeline_events" (("detail"->>'fixtureId'), "sequence")
WHERE "event" = 'protected_submission_admitted';

CREATE INDEX "pipeline_protected_cleanup_idx"
ON "audit_pipeline_events" ("executionId")
WHERE "event" = 'protected_cleanup_completed';
