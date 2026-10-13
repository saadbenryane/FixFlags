ALTER TABLE "audits" ADD COLUMN "watchNotificationAttemptCeiling" INTEGER NOT NULL DEFAULT 5, ADD COLUMN "planAtAdmission" "Plan";
ALTER TABLE "uptime_notifications" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 8;
-- Retain only the legacy unread tail; a read cursor never acknowledges hidden unread messages.
UPDATE "support_sessions" s SET "agentReadThrough" = COALESCE((SELECT MAX(m.sequence) FROM "support_messages" m WHERE m."sessionId"=s.id AND m.sequence < COALESCE((SELECT MIN(t.sequence) FROM (SELECT sequence FROM "support_messages" WHERE "sessionId"=s.id AND role='VISITOR' ORDER BY sequence DESC LIMIT s."unreadByAgent") t),s."nextMessageSequence"+1)),0);
