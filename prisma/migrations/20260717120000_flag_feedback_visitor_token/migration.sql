-- AlterTable
ALTER TABLE "flag_feedback" ADD COLUMN "visitorToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "flag_feedback_flagId_visitorToken_key" ON "flag_feedback"("flagId", "visitorToken");
