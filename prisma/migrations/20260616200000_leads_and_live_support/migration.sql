-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'QUALIFIED', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED');

-- CreateEnum
CREATE TYPE "AuditSource" AS ENUM ('HOMEPAGE', 'DASHBOARD', 'API', 'MCP', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SupportSessionStatus" AS ENUM ('OPEN', 'WAITING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportMessageRole" AS ENUM ('VISITOR', 'AGENT', 'SYSTEM');

-- AlterTable
ALTER TABLE "audits" ADD COLUMN "normalizedDomain" TEXT,
ADD COLUMN "source" "AuditSource" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "referrer" TEXT,
ADD COLUMN "utmSource" TEXT,
ADD COLUMN "utmMedium" TEXT,
ADD COLUMN "utmCampaign" TEXT;

-- CreateIndex
CREATE INDEX "audits_normalizedDomain_idx" ON "audits"("normalizedDomain");

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 1,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "latestScore" INTEGER,
    "latestAuditId" TEXT,
    "latestUrl" TEXT,
    "linkedUserId" TEXT,
    "notes" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isUnlimited" BOOLEAN NOT NULL DEFAULT true,
    "ownerUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "visitorToken" TEXT NOT NULL,
    "visitorName" TEXT,
    "visitorEmail" TEXT,
    "userId" TEXT,
    "status" "SupportSessionStatus" NOT NULL DEFAULT 'OPEN',
    "pageUrl" TEXT,
    "leadId" TEXT,
    "assignedAgentId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastNotifiedAt" TIMESTAMP(3),
    "unreadByAgent" INTEGER NOT NULL DEFAULT 0,
    "unreadByVisitor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "SupportMessageRole" NOT NULL,
    "body" TEXT NOT NULL,
    "senderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leads_normalizedDomain_key" ON "leads"("normalizedDomain");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_lastSeenAt_idx" ON "leads"("lastSeenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "support_tenants_slug_key" ON "support_tenants"("slug");

-- CreateIndex
CREATE INDEX "support_sessions_tenantId_visitorToken_idx" ON "support_sessions"("tenantId", "visitorToken");

-- CreateIndex
CREATE INDEX "support_sessions_tenantId_status_lastMessageAt_idx" ON "support_sessions"("tenantId", "status", "lastMessageAt" DESC);

-- CreateIndex
CREATE INDEX "support_sessions_leadId_idx" ON "support_sessions"("leadId");

-- CreateIndex
CREATE INDEX "support_messages_sessionId_createdAt_idx" ON "support_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "support_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_sessions" ADD CONSTRAINT "support_sessions_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "support_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
