-- CreateTable
CREATE TABLE "GscConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry" TIMESTAMP(3) NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GscConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchPerformance" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "device" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "dateRange" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "SearchPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexStatus" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "coverageState" TEXT NOT NULL,
    "robotsTxtState" TEXT NOT NULL,
    "indexingState" TEXT NOT NULL,
    "lastCrawlTime" TIMESTAMP(3),
    "googleCanonical" TEXT,
    "userCanonical" TEXT,
    "crawledAs" TEXT,
    "sitemap" TEXT[],
    "richResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "IndexStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GscConnection_userId_key" ON "GscConnection"("userId");

-- CreateIndex
CREATE INDEX "GscConnection_userId_idx" ON "GscConnection"("userId");

-- CreateIndex
CREATE INDEX "SearchPerformance_auditId_idx" ON "SearchPerformance"("auditId");

-- CreateIndex
CREATE INDEX "SearchPerformance_url_idx" ON "SearchPerformance"("url");

-- CreateIndex
CREATE INDEX "SearchPerformance_query_idx" ON "SearchPerformance"("query");

-- CreateIndex
CREATE INDEX "IndexStatus_auditId_idx" ON "IndexStatus"("auditId");

-- CreateIndex
CREATE UNIQUE INDEX "IndexStatus_auditId_url_key" ON "IndexStatus"("auditId", "url");

-- AddForeignKey
ALTER TABLE "GscConnection" ADD CONSTRAINT "GscConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GscConnection"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexStatus" ADD CONSTRAINT "IndexStatus_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndexStatus" ADD CONSTRAINT "IndexStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "GscConnection"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

