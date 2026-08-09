CREATE TABLE "chat_usage_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "limitTokens" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reservedTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_usage_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "chat_usage_reservations" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "reservedTokens" INTEGER NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    CONSTRAINT "chat_usage_reservations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chat_usage_periods_userId_periodStart_key" ON "chat_usage_periods"("userId", "periodStart");
CREATE INDEX "chat_usage_periods_periodEnd_idx" ON "chat_usage_periods"("periodEnd");
CREATE INDEX "chat_usage_reservations_periodId_status_expiresAt_idx" ON "chat_usage_reservations"("periodId", "status", "expiresAt");

ALTER TABLE "chat_usage_periods" ADD CONSTRAINT "chat_usage_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_usage_reservations" ADD CONSTRAINT "chat_usage_reservations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "chat_usage_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
