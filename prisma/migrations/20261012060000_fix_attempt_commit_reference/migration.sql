ALTER TABLE "improvement_attempts" ADD COLUMN "commitReference" TEXT;
ALTER TABLE "improvement_attempts" ADD COLUMN "frozen" BOOLEAN NOT NULL DEFAULT false;

-- Distinct recorded repairs may coexist while one verification is running.
-- Their request keys and named verifier attempts provide independent identity.
DROP INDEX "improvement_attempts_one_open_per_source";

UPDATE "improvement_attempts" SET "frozen" = true
WHERE "idempotencyKey" IS NOT NULL OR "verificationAuditId" IS NOT NULL OR "outcome" IS NOT NULL;

CREATE FUNCTION protect_improvement_attempt_intent() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."frozen" AND
    ROW(NEW."sourceAuditId", NEW."builder", NEW."handoffReference", NEW."pullRequestReference",
      NEW."commitReference", NEW."deploymentReference", NEW."changeSummary", NEW."idempotencyKey", NEW."requestHash")
    IS DISTINCT FROM
    ROW(OLD."sourceAuditId", OLD."builder", OLD."handoffReference", OLD."pullRequestReference",
      OLD."commitReference", OLD."deploymentReference", OLD."changeSummary", OLD."idempotencyKey", OLD."requestHash") THEN
    RAISE EXCEPTION 'Recorded improvement attempt intent is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."idempotencyKey" IS NOT NULL OR NEW."verificationAuditId" IS NOT NULL OR NEW."outcome" IS NOT NULL
    OR (TG_OP = 'UPDATE' AND OLD."frozen") THEN
    NEW."frozen" := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER improvement_attempt_intent_immutable
BEFORE INSERT OR UPDATE ON "improvement_attempts"
FOR EACH ROW EXECUTE FUNCTION protect_improvement_attempt_intent();
