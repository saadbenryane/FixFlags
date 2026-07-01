-- AlterTable
ALTER TABLE "audits" ADD COLUMN "triageAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "audit_run_costs" ADD COLUMN "triageInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "triageOutputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "triageModel" TEXT,
ADD COLUMN "triageCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
ADD COLUMN "prescriptionInputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "prescriptionOutputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "prescriptionModel" TEXT,
ADD COLUMN "prescriptionCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0;
