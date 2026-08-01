-- AlterTable
ALTER TABLE "users" ADD COLUMN "founderOfferRedeemedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "paid_plan_waitlist_entries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "campaign" TEXT,
    "invitedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "founderOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paid_plan_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paid_plan_waitlist_entries_plan_joinedAt_idx" ON "paid_plan_waitlist_entries"("plan", "joinedAt" DESC);

-- CreateIndex
CREATE INDEX "paid_plan_waitlist_entries_invitedAt_idx" ON "paid_plan_waitlist_entries"("invitedAt");

-- CreateIndex
CREATE UNIQUE INDEX "paid_plan_waitlist_entries_userId_plan_key" ON "paid_plan_waitlist_entries"("userId", "plan");

-- AddForeignKey
ALTER TABLE "paid_plan_waitlist_entries" ADD CONSTRAINT "paid_plan_waitlist_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
