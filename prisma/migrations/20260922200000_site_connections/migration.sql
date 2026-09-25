CREATE TYPE "SiteConnectionProvider" AS ENUM ('SEARCH_CONSOLE', 'ANALYTICS');
CREATE TYPE "SiteConnectionStatus" AS ENUM ('CONNECTED', 'MISMATCH', 'NEEDS_REAUTH', 'REVOKED');

CREATE TABLE "site_connections" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "provider" "SiteConnectionProvider" NOT NULL,
  "externalAccount" TEXT,
  "propertyId" TEXT,
  "propertyLabel" TEXT,
  "encryptedAccessToken" TEXT,
  "encryptedRefreshToken" TEXT,
  "tokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT NOT NULL DEFAULT '',
  "status" "SiteConnectionStatus" NOT NULL DEFAULT 'NEEDS_REAUTH',
  "statusDetail" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_connections_projectId_provider_key" ON "site_connections"("projectId", "provider");
CREATE INDEX "site_connections_projectId_idx" ON "site_connections"("projectId");

ALTER TABLE "site_connections"
  ADD CONSTRAINT "site_connections_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "site_connection_facts" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "pagePath" TEXT,
  "subject" TEXT NOT NULL,
  "clicks" INTEGER,
  "impressions" INTEGER,
  "sessions" INTEGER,
  "position" DOUBLE PRECISION,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_connection_facts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_connection_facts_projectId_kind_idx" ON "site_connection_facts"("projectId", "kind");
CREATE INDEX "site_connection_facts_projectId_pagePath_idx" ON "site_connection_facts"("projectId", "pagePath");

ALTER TABLE "site_connection_facts"
  ADD CONSTRAINT "site_connection_facts_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "site_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
