-- AlterTable
ALTER TABLE "leads" ADD COLUMN "totalCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
ADD COLUMN "latestScanCostUsd" DECIMAL(10,6);
