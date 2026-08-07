-- CreateEnum
CREATE TYPE "WaitlistInviteStatus" AS ENUM ('PENDING', 'JOINED', 'REVOKED');

-- CreateEnum
CREATE TYPE "WaitlistLeadStatus" AS ENUM ('PENDING', 'CLAIMED');

-- AlterTable
ALTER TABLE "paid_plan_waitlist_entries" ADD COLUMN     "accessGrantedAt" TIMESTAMP(3),
ADD COLUMN     "batch" INTEGER;

-- CreateTable
CREATE TABLE "waitlist_invites" (
    "id" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "inviterUserId" TEXT,
    "plan" "Plan" NOT NULL,
    "batch" INTEGER,
    "status" "WaitlistInviteStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedAt" TIMESTAMP(3),
    "joinedUserId" TEXT,

    CONSTRAINT "waitlist_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "Plan" NOT NULL,
    "batch" INTEGER,
    "accessGrantedAt" TIMESTAMP(3),
    "source" TEXT,
    "campaign" TEXT,
    "status" "WaitlistLeadStatus" NOT NULL DEFAULT 'PENDING',
    "claimedUserId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "waitlist_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_invites_code_key" ON "waitlist_invites"("code");

-- CreateIndex
CREATE INDEX "waitlist_invites_plan_batch_idx" ON "waitlist_invites"("plan", "batch");

-- CreateIndex
CREATE INDEX "waitlist_invites_inviteeEmail_idx" ON "waitlist_invites"("inviteeEmail");

-- CreateIndex
CREATE INDEX "waitlist_invites_status_idx" ON "waitlist_invites"("status");

-- CreateIndex
CREATE INDEX "waitlist_leads_plan_status_idx" ON "waitlist_leads"("plan", "status");

-- CreateIndex
CREATE INDEX "waitlist_leads_plan_batch_idx" ON "waitlist_leads"("plan", "batch");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_leads_email_plan_key" ON "waitlist_leads"("email", "plan");

-- CreateIndex
CREATE INDEX "paid_plan_waitlist_entries_plan_batch_idx" ON "paid_plan_waitlist_entries"("plan", "batch");

-- CreateIndex
CREATE INDEX "paid_plan_waitlist_entries_accessGrantedAt_idx" ON "paid_plan_waitlist_entries"("accessGrantedAt");

-- AddForeignKey
ALTER TABLE "waitlist_invites" ADD CONSTRAINT "waitlist_invites_inviterUserId_fkey" FOREIGN KEY ("inviterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_invites" ADD CONSTRAINT "waitlist_invites_joinedUserId_fkey" FOREIGN KEY ("joinedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waitlist_leads" ADD CONSTRAINT "waitlist_leads_claimedUserId_fkey" FOREIGN KEY ("claimedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
