-- A zero-regression Watch result can either be unchanged (must stay quiet) or
-- a recovery (may notify when the customer opted in). Persist the recovery
-- count so launch evidence never infers quiet-success behavior from an
-- ambiguous notification state. Historical rows remain NULL and are reported
-- as unavailable evidence rather than silently passing.
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "watchRecoveryCount" INTEGER;
