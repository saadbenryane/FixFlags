-- Append-only confirmation attempts for Outcome bindings.
--
-- OutcomeBindingExecution stays the latest-conclusive projection so the state
-- contract keeps reading one current verdict per binding. This table keeps every
-- attempt, including a failure that a later attempt recovered, so flakiness
-- stays diagnosable instead of being overwritten or hidden.
CREATE TABLE "outcome_binding_attempts" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "bindingKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "mechanism" "OutcomeExecutionMechanism" NOT NULL,
    "disposition" "BindingDisposition" NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" JSONB,
    "transient" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executionId" TEXT,

    CONSTRAINT "outcome_binding_attempts_pkey" PRIMARY KEY ("id")
);

-- The unique index name is Prisma's own truncated form. Writing the full
-- identifier here would let Postgres truncate it to a different name and leave
-- the schema permanently in drift.
CREATE UNIQUE INDEX "outcome_binding_attempts_auditId_outcomeId_bindingKey_attem_key"
    ON "outcome_binding_attempts"("auditId", "outcomeId", "bindingKey", "attempt");

CREATE INDEX "outcome_binding_attempts_outcomeId_bindingKey_attempt_idx"
    ON "outcome_binding_attempts"("outcomeId", "bindingKey", "attempt" DESC);

CREATE INDEX "outcome_binding_attempts_executionId_idx"
    ON "outcome_binding_attempts"("executionId");

ALTER TABLE "outcome_binding_attempts"
    ADD CONSTRAINT "outcome_binding_attempts_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outcome_binding_attempts"
    ADD CONSTRAINT "outcome_binding_attempts_outcomeId_fkey"
    FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "outcome_binding_attempts"
    ADD CONSTRAINT "outcome_binding_attempts_executionId_fkey"
    FOREIGN KEY ("executionId") REFERENCES "outcome_binding_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one attempt per existing execution so historical evidence keeps a
-- durable attempt row and later confirmation attempts continue the same sequence.
INSERT INTO "outcome_binding_attempts" (
    "id", "auditId", "outcomeId", "bindingKey", "attempt",
    "mechanism", "disposition", "reason", "detail", "transient", "createdAt", "executionId"
)
SELECT
    execution."id",
    execution."auditId",
    execution."outcomeId",
    execution."bindingKey",
    1,
    execution."mechanism",
    execution."disposition",
    execution."reason",
    execution."detail",
    false,
    execution."createdAt",
    execution."id"
FROM "outcome_binding_executions" AS execution;
