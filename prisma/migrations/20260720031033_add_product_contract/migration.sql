-- AlterTable
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "productContract" JSONB;
