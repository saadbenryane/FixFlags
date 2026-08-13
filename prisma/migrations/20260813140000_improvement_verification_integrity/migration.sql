ALTER TABLE "improvement_attempts"
ADD COLUMN "sourceAuditId" TEXT,
ADD COLUMN "comparable" BOOLEAN,
ADD COLUMN "verificationCoverage" JSONB,
ADD COLUMN "verificationReason" TEXT;

ALTER TABLE "audits"
ADD COLUMN "improvementProjectedAt" TIMESTAMP(3);

UPDATE "improvement_attempts" AS attempt
SET "sourceAuditId" = occurrence."auditId"
FROM (
  SELECT DISTINCT ON ("improvementId") "improvementId", "auditId"
  FROM "improvement_occurrences"
  ORDER BY "improvementId", "createdAt" DESC
) AS occurrence
WHERE occurrence."improvementId" = attempt."improvementId";

DELETE FROM "improvement_attempts" WHERE "sourceAuditId" IS NULL;

ALTER TABLE "improvement_attempts"
ALTER COLUMN "sourceAuditId" SET NOT NULL;

CREATE INDEX "improvement_attempts_sourceAuditId_idx"
ON "improvement_attempts"("sourceAuditId");

CREATE UNIQUE INDEX "improvement_attempts_one_open_per_source"
ON "improvement_attempts"("improvementId", "sourceAuditId")
WHERE "outcome" IS NULL;

ALTER TABLE "improvement_attempts"
ADD CONSTRAINT "improvement_attempts_sourceAuditId_fkey"
FOREIGN KEY ("sourceAuditId") REFERENCES "audits"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
