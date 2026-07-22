-- Product identity, Product Intelligence concurrency, durable watch state,
-- explicit re-check provenance, and secure share-link storage.

CREATE TYPE "ProjectWatchInterval" AS ENUM ('WEEKLY', 'DAILY');
CREATE TYPE "RecheckTrigger" AS ENUM ('MANUAL', 'WATCH');
CREATE TYPE "WatchNotificationStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENDING', 'SENT', 'FAILED');

ALTER TABLE "projects" ADD COLUMN "canonicalHost" TEXT;
ALTER TABLE "projects" ADD COLUMN "isManaged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "productIntelligenceRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN "watchLeaseUntil" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "watchLastAttemptAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN "watchConsecutiveFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "projects" ADD COLUMN "watchLastError" TEXT;

UPDATE "projects"
SET "canonicalHost" = lower(
  regexp_replace(
    regexp_replace(
      split_part(regexp_replace("url", '^[a-zA-Z][a-zA-Z0-9+.-]*://', ''), '/', 1),
      ':\d+$',
      ''
    ),
    '^www\.',
    ''
  )
);

UPDATE "projects" SET "canonicalHost" = lower("id") WHERE "canonicalHost" IS NULL OR "canonicalHost" = '';
UPDATE "projects" SET "isManaged" = NOT "isAnchor";

-- Fold duplicate historical Products into one exact-host Product. Prefer a
-- managed record, then the most recently updated record. Arrays from Product
-- Intelligence are appended so learnings, notes, risks, constraints, outcomes,
-- and decisions survive the merge.
DO $$
DECLARE
  duplicate RECORD;
BEGIN
  FOR duplicate IN
    WITH ranked AS (
      SELECT
        "id",
        first_value("id") OVER (
          PARTITION BY "userId", "canonicalHost"
          ORDER BY "isManaged" DESC, "updatedAt" DESC, "id"
        ) AS winner_id,
        row_number() OVER (
          PARTITION BY "userId", "canonicalHost"
          ORDER BY "isManaged" DESC, "updatedAt" DESC, "id"
        ) AS position
      FROM "projects"
    )
    SELECT "id" AS loser_id, winner_id FROM ranked WHERE position > 1
  LOOP
    UPDATE "projects" AS winner
    SET
      "isManaged" = winner."isManaged" OR loser."isManaged",
      "productIntelligence" = CASE
        WHEN loser."productIntelligence" IS NULL THEN winner."productIntelligence"
        WHEN winner."productIntelligence" IS NULL THEN loser."productIntelligence"
        ELSE
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      loser."productIntelligence"::jsonb || winner."productIntelligence"::jsonb,
                      '{criticalOutcomes}',
                      coalesce(winner."productIntelligence"::jsonb->'criticalOutcomes', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'criticalOutcomes', '[]'::jsonb),
                      true
                    ),
                    '{constraints}',
                    coalesce(winner."productIntelligence"::jsonb->'constraints', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'constraints', '[]'::jsonb),
                    true
                  ),
                  '{decisions}',
                  coalesce(winner."productIntelligence"::jsonb->'decisions', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'decisions', '[]'::jsonb),
                  true
                ),
                '{knownRisks}',
                coalesce(winner."productIntelligence"::jsonb->'knownRisks', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'knownRisks', '[]'::jsonb),
                true
              ),
              '{verifiedLearnings}',
              coalesce(winner."productIntelligence"::jsonb->'verifiedLearnings', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'verifiedLearnings', '[]'::jsonb),
              true
            ),
            '{intentionalNotes}',
            coalesce(winner."productIntelligence"::jsonb->'intentionalNotes', '[]'::jsonb) || coalesce(loser."productIntelligence"::jsonb->'intentionalNotes', '[]'::jsonb),
            true
          )
      END
    FROM "projects" AS loser
    WHERE winner."id" = duplicate.winner_id AND loser."id" = duplicate.loser_id;

    UPDATE "audits" SET "projectId" = duplicate.winner_id WHERE "projectId" = duplicate.loser_id;
    DELETE FROM "projects" WHERE "id" = duplicate.loser_id;
  END LOOP;
END $$;

ALTER TABLE "projects" ALTER COLUMN "canonicalHost" SET NOT NULL;

ALTER TABLE "projects" ADD COLUMN "watchIntervalTyped" "ProjectWatchInterval";
UPDATE "projects"
SET "watchIntervalTyped" = CASE lower("watchInterval")
  WHEN 'weekly' THEN 'WEEKLY'::"ProjectWatchInterval"
  WHEN 'daily' THEN 'DAILY'::"ProjectWatchInterval"
  ELSE NULL
END;
ALTER TABLE "projects" DROP COLUMN "watchInterval";
ALTER TABLE "projects" RENAME COLUMN "watchIntervalTyped" TO "watchInterval";
ALTER TABLE "projects" DROP COLUMN "isAnchor";

DROP INDEX IF EXISTS "projects_userId_url_idx";
CREATE UNIQUE INDEX "projects_userId_canonicalHost_key" ON "projects"("userId", "canonicalHost");
CREATE INDEX "projects_watchLeaseUntil_idx" ON "projects"("watchLeaseUntil");

ALTER TABLE "audits" ADD COLUMN "recheckTrigger" "RecheckTrigger";
ALTER TABLE "audits" ADD COLUMN "watchRegressionCount" INTEGER;
ALTER TABLE "audits" ADD COLUMN "watchNotificationStatus" "WatchNotificationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE';
ALTER TABLE "audits" ADD COLUMN "watchNotificationAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "audits" ADD COLUMN "watchNotificationLastError" TEXT;

ALTER TABLE "share_links" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "share_links" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
UPDATE "share_links" SET "revoked" = true WHERE "password" IS NOT NULL;
ALTER TABLE "share_links" DROP COLUMN "password";

