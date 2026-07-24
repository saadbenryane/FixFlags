CREATE TYPE "ApiKeyClient" AS ENUM (
  'cursor',
  'claudeCode',
  'windsurf',
  'lovable',
  'bolt',
  'vscode',
  'other'
);

ALTER TABLE "api_keys"
ADD COLUMN "client" "ApiKeyClient";

CREATE INDEX "api_keys_client_idx" ON "api_keys"("client");

ALTER TABLE "mcp_interactions"
ADD COLUMN "apiKeyId" TEXT,
ADD COLUMN "client" "ApiKeyClient";

CREATE INDEX "mcp_interactions_apiKeyId_createdAt_idx"
ON "mcp_interactions"("apiKeyId", "createdAt");

CREATE INDEX "mcp_interactions_client_createdAt_idx"
ON "mcp_interactions"("client", "createdAt");

ALTER TABLE "mcp_interactions"
ADD CONSTRAINT "mcp_interactions_apiKeyId_fkey"
FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
