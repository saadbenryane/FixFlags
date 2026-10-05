ALTER TABLE "outcome_fixtures"
  ALTER COLUMN "authorizedAt" DROP NOT NULL,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "lastDryRunVersion" INTEGER,
  ADD COLUMN "lastDryRunAt" TIMESTAMP(3),
  ADD COLUMN "lastDryRunResult" JSONB;
