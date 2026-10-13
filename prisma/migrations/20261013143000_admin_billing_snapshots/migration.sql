-- AlterTable
ALTER TABLE "admin_operations" ADD COLUMN     "providerRevision" TEXT;

-- CreateTable
CREATE TABLE "billing_subscription_snapshots" (
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "items" JSONB NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,

    CONSTRAINT "billing_subscription_snapshots_pkey" PRIMARY KEY ("subscriptionId")
);

-- CreateIndex
CREATE INDEX "billing_subscription_snapshots_userId_status_idx" ON "billing_subscription_snapshots"("userId", "status");

-- AddForeignKey
ALTER TABLE "billing_subscription_snapshots" ADD CONSTRAINT "billing_subscription_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

