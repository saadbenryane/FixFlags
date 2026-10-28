ALTER TABLE "projects" ADD COLUMN "watchPausedAt" TIMESTAMP(3);

-- Preserve known explicit pauses without treating a halted analysis clock as consent.
-- updatedAt is the migration baseline, not recovered historical pause provenance.
UPDATE "projects" SET "watchPausedAt" = "updatedAt"
WHERE "watchNextRunAt" IS NULL
  AND "watchLastError" IN ('Paused.', 'Paused. This Site is not on a check schedule.');
