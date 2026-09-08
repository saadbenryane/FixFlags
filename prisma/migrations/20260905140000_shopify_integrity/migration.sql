-- CreateEnum
CREATE TYPE "IntegrityHealth" AS ENUM ('GREEN', 'RED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "shopify_shops" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "primaryUrl" TEXT,
    "encryptedAccessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL DEFAULT 'read_products',
    "slackWebhookEncrypted" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalledAt" TIMESTAMP(3),
    "lastProbeAt" TIMESTAMP(3),

    CONSTRAINT "shopify_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_paths" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productGid" TEXT,
    "storefrontUrl" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "taggedPaidTraffic" BOOLEAN NOT NULL DEFAULT false,
    "health" "IntegrityHealth" NOT NULL DEFAULT 'UNKNOWN',
    "reason" TEXT,
    "failedStep" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastTransitionAt" TIMESTAMP(3),
    "lastVideoUrl" TEXT,
    "lastGifUrl" TEXT,
    "lastScreenshotUrl" TEXT,
    "watchNextRunAt" TIMESTAMP(3),
    "watchLeaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_runs" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "health" "IntegrityHealth" NOT NULL,
    "reason" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "trigger" TEXT NOT NULL,
    "videoUrl" TEXT,
    "gifUrl" TEXT,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrity_waitlist" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrity_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_shops_shopDomain_key" ON "shopify_shops"("shopDomain");

-- CreateIndex
CREATE INDEX "shopify_shops_uninstalledAt_idx" ON "shopify_shops"("uninstalledAt");

-- CreateIndex
CREATE INDEX "revenue_paths_shopId_idx" ON "revenue_paths"("shopId");

-- CreateIndex
CREATE INDEX "revenue_paths_watchNextRunAt_idx" ON "revenue_paths"("watchNextRunAt");

-- CreateIndex
CREATE INDEX "verification_runs_pathId_createdAt_idx" ON "verification_runs"("pathId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "integrity_waitlist_shopId_featureKey_key" ON "integrity_waitlist"("shopId", "featureKey");

-- AddForeignKey
ALTER TABLE "revenue_paths" ADD CONSTRAINT "revenue_paths_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "revenue_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrity_waitlist" ADD CONSTRAINT "integrity_waitlist_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
