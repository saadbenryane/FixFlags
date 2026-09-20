CREATE TYPE "SiteNotificationLevel" AS ENUM ('FLAGS', 'CRITICAL_ONLY', 'OFF');
CREATE TYPE "SiteAgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

ALTER TABLE "projects"
  ADD COLUMN "notificationLevel" "SiteNotificationLevel" NOT NULL DEFAULT 'FLAGS',
  ADD COLUMN "notifyOnRecovery" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN "licensedSiteQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stripeSubscriptionEventAt" TIMESTAMP(3);

ALTER TABLE "subscription_lifecycle_events"
  ADD COLUMN "siteQuantity" INTEGER,
  ADD COLUMN "stale" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "support_sessions"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "flagId" TEXT,
  ADD COLUMN "transcriptSummary" TEXT;

ALTER TABLE "shopify_shops"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "linkedAt" TIMESTAMP(3);

CREATE TABLE "shopify_account_links" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "shopId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shopify_account_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_agent_threads" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_agent_threads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_agent_messages" (
  "id" TEXT NOT NULL,
  "threadId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "SiteAgentMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_agent_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_lifecycle_events" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "idempotencyKey" TEXT NOT NULL,
  "userId" TEXT,
  "projectId" TEXT,
  "properties" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_account_links_tokenHash_key" ON "shopify_account_links"("tokenHash");
CREATE INDEX "shopify_account_links_projectId_expiresAt_idx" ON "shopify_account_links"("projectId", "expiresAt");
CREATE INDEX "shopify_account_links_shopId_idx" ON "shopify_account_links"("shopId");
CREATE UNIQUE INDEX "shopify_shops_projectId_key" ON "shopify_shops"("projectId");
CREATE INDEX "site_agent_threads_projectId_updatedAt_idx" ON "site_agent_threads"("projectId", "updatedAt" DESC);
CREATE INDEX "site_agent_threads_userId_updatedAt_idx" ON "site_agent_threads"("userId", "updatedAt" DESC);
CREATE INDEX "site_agent_messages_threadId_createdAt_idx" ON "site_agent_messages"("threadId", "createdAt");
CREATE INDEX "site_agent_messages_userId_createdAt_idx" ON "site_agent_messages"("userId", "createdAt" DESC);
CREATE UNIQUE INDEX "site_lifecycle_events_idempotencyKey_key" ON "site_lifecycle_events"("idempotencyKey");
CREATE INDEX "site_lifecycle_events_name_createdAt_idx" ON "site_lifecycle_events"("name", "createdAt" DESC);
CREATE INDEX "site_lifecycle_events_projectId_createdAt_idx" ON "site_lifecycle_events"("projectId", "createdAt" DESC);
CREATE INDEX "site_lifecycle_events_userId_createdAt_idx" ON "site_lifecycle_events"("userId", "createdAt" DESC);
CREATE INDEX "support_sessions_projectId_updatedAt_idx" ON "support_sessions"("projectId", "updatedAt" DESC);

ALTER TABLE "shopify_shops" ADD CONSTRAINT "shopify_shops_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shopify_account_links" ADD CONSTRAINT "shopify_account_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_account_links" ADD CONSTRAINT "shopify_account_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_account_links" ADD CONSTRAINT "shopify_account_links_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shopify_shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_agent_threads" ADD CONSTRAINT "site_agent_threads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_agent_threads" ADD CONSTRAINT "site_agent_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_agent_messages" ADD CONSTRAINT "site_agent_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "site_agent_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_agent_messages" ADD CONSTRAINT "site_agent_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_lifecycle_events" ADD CONSTRAINT "site_lifecycle_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_lifecycle_events" ADD CONSTRAINT "site_lifecycle_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
