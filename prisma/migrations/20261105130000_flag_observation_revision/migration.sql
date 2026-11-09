ALTER TABLE "flags"
  ADD COLUMN "supportingObservationVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "supportingObservationIndex" JSONB;

-- Every writer, including retained clients, invalidates derived revision
-- metadata when the original observations change. Workflow changes retain it.
CREATE FUNCTION maintain_flag_observation_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."supportingObservations" IS DISTINCT FROM OLD."supportingObservations" THEN
    NEW."supportingObservationVersion" := OLD."supportingObservationVersion" + 1;
    NEW."supportingObservationIndex" := NULL;
  ELSE
    NEW."supportingObservationVersion" := OLD."supportingObservationVersion";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER flag_observation_revision
BEFORE UPDATE OF "supportingObservations", "supportingObservationVersion", "supportingObservationIndex"
ON "flags" FOR EACH ROW EXECUTE FUNCTION maintain_flag_observation_revision();
