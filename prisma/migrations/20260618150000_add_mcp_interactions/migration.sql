-- CreateTable
CREATE TABLE "mcp_interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'unknown',
    "tool" TEXT,
    "durationMs" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorCode" TEXT,
    "auditId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mcp_interactions_userId_createdAt_idx" ON "mcp_interactions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "mcp_interactions_createdAt_idx" ON "mcp_interactions"("createdAt");

-- CreateIndex
CREATE INDEX "mcp_interactions_method_tool_idx" ON "mcp_interactions"("method", "tool");

-- CreateIndex
CREATE INDEX "mcp_interactions_success_createdAt_idx" ON "mcp_interactions"("success", "createdAt");

-- AddForeignKey
ALTER TABLE "mcp_interactions" ADD CONSTRAINT "mcp_interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
