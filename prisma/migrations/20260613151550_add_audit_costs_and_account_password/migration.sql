-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "password" TEXT;

-- CreateTable
CREATE TABLE "audit_run_costs" (
    "auditId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "llmInputTokens" INTEGER NOT NULL DEFAULT 0,
    "llmOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "llmModel" TEXT,
    "llmCostUsd" DECIMAL(10,6) NOT NULL,
    "pagespeedCalls" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(10,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_run_costs_pkey" PRIMARY KEY ("auditId")
);

-- AddForeignKey
ALTER TABLE "audit_run_costs" ADD CONSTRAINT "audit_run_costs_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
