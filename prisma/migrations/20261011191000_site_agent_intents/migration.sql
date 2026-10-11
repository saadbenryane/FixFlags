CREATE TABLE "site_agent_intents" (
  "id" TEXT NOT NULL, "threadId" TEXT NOT NULL, "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "flagId" TEXT, "status" TEXT NOT NULL DEFAULT 'PENDING', "response" JSONB, "reservationId" TEXT,
  "errorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
  CONSTRAINT "site_agent_intents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "site_agent_intents_threadId_requestKey_key" ON "site_agent_intents"("threadId", "requestKey");
CREATE INDEX "site_agent_intents_threadId_status_createdAt_idx" ON "site_agent_intents"("threadId", "status", "createdAt");
ALTER TABLE "site_agent_intents" ADD CONSTRAINT "site_agent_intents_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "site_agent_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_agent_messages" ADD COLUMN "intentId" TEXT;
CREATE UNIQUE INDEX "site_agent_messages_intentId_role_key" ON "site_agent_messages"("intentId", "role");
ALTER TABLE "site_agent_messages" ADD CONSTRAINT "site_agent_messages_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "site_agent_intents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
