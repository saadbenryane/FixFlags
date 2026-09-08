-- AlterTable
ALTER TABLE "shopify_shops" ADD COLUMN "encryptedRefreshToken" TEXT;
ALTER TABLE "shopify_shops" ADD COLUMN "refreshExpiresAt" TIMESTAMP(3);
ALTER TABLE "shopify_shops" ADD COLUMN "activationTrackedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "revenue_paths" ADD COLUMN "pulseNextRunAt" TIMESTAMP(3);
ALTER TABLE "revenue_paths" ADD COLUMN "pulseLeaseUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "revenue_paths_pulseNextRunAt_idx" ON "revenue_paths"("pulseNextRunAt");

-- CreateTable
CREATE TABLE "improve_items" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "checkId" TEXT,
    "evidenceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "improve_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "improve_items_pathId_createdAt_idx" ON "improve_items"("pathId", "createdAt");

-- AddForeignKey
ALTER TABLE "improve_items" ADD CONSTRAINT "improve_items_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "revenue_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "shopify_gdpr_requests" (
    "id" TEXT NOT NULL,
    "shopId" TEXT,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_gdpr_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_gdpr_requests_createdAt_idx" ON "shopify_gdpr_requests"("createdAt");

-- AddForeignKey
ALTER TABLE "shopify_gdpr_requests" ADD CONSTRAINT "shopify_gdpr_requests_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
