CREATE TYPE "OutcomeBindingPolicy" AS ENUM ('ALL_REQUIRED');
CREATE TYPE "BindingDisposition" AS ENUM ('SUCCEEDED', 'FAILED', 'BLOCKED');

ALTER TABLE "site_outcomes"
  ADD COLUMN "bindingPolicy" "OutcomeBindingPolicy" NOT NULL DEFAULT 'ALL_REQUIRED';

CREATE TABLE "outcome_binding_executions" (
  "id" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "outcomeId" TEXT NOT NULL,
  "bindingKey" TEXT NOT NULL,
  "mechanism" "OutcomeExecutionMechanism" NOT NULL,
  "disposition" "BindingDisposition" NOT NULL,
  "reason" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outcome_binding_executions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outcome_binding_executions_auditId_outcomeId_bindingKey_key"
  ON "outcome_binding_executions"("auditId", "outcomeId", "bindingKey");
CREATE INDEX "outcome_binding_executions_outcomeId_createdAt_idx"
  ON "outcome_binding_executions"("outcomeId", "createdAt" DESC);

ALTER TABLE "outcome_binding_executions"
  ADD CONSTRAINT "outcome_binding_executions_auditId_fkey"
  FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "outcome_binding_executions"
  ADD CONSTRAINT "outcome_binding_executions_outcomeId_fkey"
  FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys"
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "audience" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE TABLE "oauth_clients" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "redirectUris" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_authorization_codes" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "codeChallenge" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_authorization_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_authorization_codes_codeHash_key" ON "oauth_authorization_codes"("codeHash");
CREATE INDEX "oauth_authorization_codes_userId_createdAt_idx" ON "oauth_authorization_codes"("userId", "createdAt");
CREATE INDEX "oauth_authorization_codes_expiresAt_idx" ON "oauth_authorization_codes"("expiresAt");

ALTER TABLE "oauth_authorization_codes"
  ADD CONSTRAINT "oauth_authorization_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "oauth_refresh_tokens" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_refresh_tokens_tokenHash_key" ON "oauth_refresh_tokens"("tokenHash");
CREATE INDEX "oauth_refresh_tokens_userId_createdAt_idx" ON "oauth_refresh_tokens"("userId", "createdAt");

ALTER TABLE "oauth_refresh_tokens"
  ADD CONSTRAINT "oauth_refresh_tokens_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
