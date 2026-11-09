CREATE TABLE "provider_spend_windows" (
    "key" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "limitMicros" BIGINT NOT NULL,
    "reservedMicros" BIGINT NOT NULL DEFAULT 0,
    "settledMicros" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provider_spend_windows_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "provider_spend_windows_nonnegative" CHECK ("limitMicros" > 0 AND "reservedMicros" >= 0 AND "settledMicros" >= 0)
);
CREATE INDEX "provider_spend_windows_expiresAt_idx" ON "provider_spend_windows"("expiresAt");
