ALTER TYPE "ApiKeyClient" ADD VALUE IF NOT EXISTS 'cli';

CREATE TYPE "CliDeviceAuthorizationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'DENIED',
  'CONSUMED'
);

CREATE TABLE "cli_device_authorizations" (
  "id" TEXT NOT NULL,
  "deviceCodeHash" TEXT NOT NULL,
  "userCodeHash" TEXT NOT NULL,
  "status" "CliDeviceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
  "intervalSeconds" INTEGER NOT NULL DEFAULT 5,
  "encryptedCredential" TEXT,
  "userId" TEXT,
  "apiKeyId" TEXT,
  "lastPolledAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cli_device_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cli_device_authorizations_deviceCodeHash_key"
  ON "cli_device_authorizations"("deviceCodeHash");
CREATE UNIQUE INDEX "cli_device_authorizations_userCodeHash_key"
  ON "cli_device_authorizations"("userCodeHash");
CREATE INDEX "cli_device_authorizations_status_expiresAt_idx"
  ON "cli_device_authorizations"("status", "expiresAt");
CREATE INDEX "cli_device_authorizations_userId_createdAt_idx"
  ON "cli_device_authorizations"("userId", "createdAt");

ALTER TABLE "cli_device_authorizations"
  ADD CONSTRAINT "cli_device_authorizations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cli_device_authorizations"
  ADD CONSTRAINT "cli_device_authorizations_apiKeyId_fkey"
  FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
