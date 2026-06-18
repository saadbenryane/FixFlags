-- AlterTable
ALTER TABLE "audits" ADD COLUMN "includeAi" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "audits" ADD COLUMN "aiReviewAt" TIMESTAMP(3);
