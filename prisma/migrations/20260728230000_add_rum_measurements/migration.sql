-- CreateTable
CREATE TABLE "rum_measurements" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" TEXT,
    "delta" DOUBLE PRECISION,
    "nav" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rum_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rum_measurements_siteId_idx" ON "rum_measurements"("siteId");

-- CreateIndex
CREATE INDEX "rum_measurements_siteId_metric_idx" ON "rum_measurements"("siteId", "metric");

-- CreateIndex
CREATE INDEX "rum_measurements_siteId_createdAt_idx" ON "rum_measurements"("siteId", "createdAt");
