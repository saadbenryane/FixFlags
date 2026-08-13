CREATE TYPE "ProductSignalKind" AS ENUM ('NAVIGATION', 'ACTION', 'OUTCOME', 'ERROR', 'PERFORMANCE', 'DEPLOYMENT');

CREATE TABLE "product_releases" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "commitRef" TEXT,
    "url" TEXT,
    "deployedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_releases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_signal_keys" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "allowedOrigin" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_signal_keys_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_signals" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "kind" "ProductSignalKind" NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT,
    "sessionHash" TEXT,
    "releaseId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "provenance" JSONB NOT NULL,
    "replayKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_signals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_releases_projectId_source_externalId_key" ON "product_releases"("projectId", "source", "externalId");
CREATE INDEX "product_releases_projectId_deployedAt_idx" ON "product_releases"("projectId", "deployedAt" DESC);
CREATE UNIQUE INDEX "product_signal_keys_keyHash_key" ON "product_signal_keys"("keyHash");
CREATE INDEX "product_signal_keys_projectId_revokedAt_idx" ON "product_signal_keys"("projectId", "revokedAt");
CREATE UNIQUE INDEX "product_signals_projectId_source_replayKey_key" ON "product_signals"("projectId", "source", "replayKey");
CREATE INDEX "product_signals_projectId_occurredAt_idx" ON "product_signals"("projectId", "occurredAt" DESC);
CREATE INDEX "product_signals_expiresAt_idx" ON "product_signals"("expiresAt");
CREATE INDEX "product_signals_releaseId_occurredAt_idx" ON "product_signals"("releaseId", "occurredAt");

ALTER TABLE "product_releases" ADD CONSTRAINT "product_releases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_signal_keys" ADD CONSTRAINT "product_signal_keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_signals" ADD CONSTRAINT "product_signals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_signals" ADD CONSTRAINT "product_signals_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "product_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
