CREATE TABLE "run_request_keys" (
  "projectId" TEXT NOT NULL,
  "source" "RunRequestSource" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "runRequestId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "run_request_keys_pkey" PRIMARY KEY ("projectId", "source", "idempotencyKey"),
  CONSTRAINT "run_request_keys_runRequestId_projectId_fkey" FOREIGN KEY ("runRequestId", "projectId")
    REFERENCES "run_requests" ("id", "projectId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "run_request_keys_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId")
    REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "run_request_keys_runRequestId_projectId_idx" ON "run_request_keys" ("runRequestId", "projectId");
CREATE INDEX "run_request_keys_requestedByUserId_idx" ON "run_request_keys" ("requestedByUserId");

-- Original keys register in the same transaction as admission, including
-- writes from an older application during an additive migration rollout.
CREATE FUNCTION fixflags_register_run_request_key() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "run_request_keys" ("projectId", "source", "idempotencyKey", "runRequestId", "requestedByUserId")
    VALUES (NEW."projectId", NEW."source", NEW."idempotencyKey", NEW.id, NEW."requestedByUserId");
  RETURN NEW;
END;
$$;
CREATE TRIGGER run_request_register_key AFTER INSERT ON "run_requests"
  FOR EACH ROW EXECUTE FUNCTION fixflags_register_run_request_key();

INSERT INTO "run_request_keys" ("projectId", "source", "idempotencyKey", "runRequestId", "requestedByUserId", "createdAt")
  SELECT "projectId", "source", "idempotencyKey", id, "requestedByUserId", "requestedAt" FROM "run_requests"
  ON CONFLICT ("projectId", "source", "idempotencyKey") DO NOTHING;

CREATE FUNCTION fixflags_preserve_run_request_key() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD."projectId", OLD."source", OLD."idempotencyKey", OLD."runRequestId") IS DISTINCT FROM
     (NEW."projectId", NEW."source", NEW."idempotencyKey", NEW."runRequestId") THEN
    RAISE EXCEPTION 'Run request key bindings are immutable' USING ERRCODE = '22000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER run_request_preserve_key BEFORE UPDATE ON "run_request_keys"
  FOR EACH ROW EXECUTE FUNCTION fixflags_preserve_run_request_key();
