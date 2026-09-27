CREATE TABLE "outcome_fixtures" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "fieldMapping" JSONB NOT NULL,
  "encryptedValues" TEXT NOT NULL,
  "successCriterion" JSONB NOT NULL,
  "resetUrl" TEXT NOT NULL,
  "cleanupUrl" TEXT NOT NULL,
  "encryptedHookSecret" TEXT,
  "authorizedAt" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outcome_fixtures_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outcome_fixtures_projectId_enabled_idx" ON "outcome_fixtures"("projectId", "enabled");
ALTER TABLE "outcome_fixtures" ADD CONSTRAINT "outcome_fixtures_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
