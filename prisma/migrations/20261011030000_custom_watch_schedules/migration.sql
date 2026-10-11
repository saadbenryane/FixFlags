ALTER TYPE "ProjectWatchInterval" ADD VALUE IF NOT EXISTS 'HOURLY';
ALTER TYPE "ProjectWatchInterval" ADD VALUE IF NOT EXISTS 'CUSTOM';

ALTER TABLE "projects" ADD COLUMN "watchEveryMinutes" INTEGER;

ALTER TABLE "projects" ADD CONSTRAINT "projects_custom_watch_interval_check" CHECK (
  ("watchInterval"::text IS DISTINCT FROM 'CUSTOM' AND "watchEveryMinutes" IS NULL)
  OR (
    "watchInterval"::text = 'CUSTOM'
    AND "watchEveryMinutes" IS NOT NULL
    AND "watchEveryMinutes" BETWEEN 60 AND 3679200
    AND "watchEveryMinutes" % 60 = 0
  )
);
