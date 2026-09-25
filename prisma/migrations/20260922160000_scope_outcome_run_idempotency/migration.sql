-- Repeated client keys are unique within an owned Site and trigger, rather
-- than across all customers. Existing rows remain valid under this index.
DROP INDEX "run_requests_idempotencyKey_key";
CREATE UNIQUE INDEX "run_requests_projectId_source_idempotencyKey_key"
  ON "run_requests"("projectId", "source", "idempotencyKey");
