-- CreateEnum
CREATE TYPE "ExpertReviewStatus" AS ENUM ('PENDING', 'PAID', 'FULFILLED');

-- CreateTable
CREATE TABLE "expert_review_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "auditId" TEXT,
    "stripeSessionId" TEXT NOT NULL,
    "status" "ExpertReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expert_review_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expert_review_orders_stripeSessionId_key" ON "expert_review_orders"("stripeSessionId");

-- CreateIndex
CREATE INDEX "expert_review_orders_userId_idx" ON "expert_review_orders"("userId");

-- AddForeignKey
ALTER TABLE "expert_review_orders" ADD CONSTRAINT "expert_review_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_review_orders" ADD CONSTRAINT "expert_review_orders_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
