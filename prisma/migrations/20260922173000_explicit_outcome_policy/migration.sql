CREATE TYPE "OutcomeCriticality" AS ENUM ('CRITICAL', 'IMPORTANT', 'INFORMATIONAL');

ALTER TABLE "site_outcomes"
  ADD COLUMN "criticality" "OutcomeCriticality" NOT NULL DEFAULT 'INFORMATIONAL',
  ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'production';
UPDATE "site_outcomes" SET "criticality" = 'CRITICAL' WHERE "kind" = 'CHECKOUT';

ALTER TABLE "outcome_execution_bindings"
  ADD COLUMN "scope" JSONB,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true;
UPDATE "outcome_execution_bindings"
SET "scope" = '{"device":"mobile","expected":"checkout_reached"}'::jsonb
WHERE "key" = 'checkout-browser-v1';

ALTER TABLE "outcome_assessments" ADD COLUMN "coverage" JSONB;
