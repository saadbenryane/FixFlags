-- Additive receipt storage preserves historical allowance and message records.
ALTER TABLE "chat_usage_reservations" ADD COLUMN "providerUsage" JSONB;
