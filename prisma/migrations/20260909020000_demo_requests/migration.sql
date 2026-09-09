-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "siteCount" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");
CREATE INDEX "demo_requests_createdAt_idx" ON "demo_requests"("createdAt");
