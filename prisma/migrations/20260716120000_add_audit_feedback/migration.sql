-- CreateTable
CREATE TABLE "audit_feedback" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT,
    "visitorToken" TEXT,
    "vote" INTEGER NOT NULL,
    "comment" TEXT,
    "pageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_feedback_auditId_idx" ON "audit_feedback"("auditId");

-- CreateIndex
CREATE INDEX "audit_feedback_vote_idx" ON "audit_feedback"("vote");

-- CreateIndex
CREATE INDEX "audit_feedback_createdAt_idx" ON "audit_feedback"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_feedback_auditId_visitorToken_key" ON "audit_feedback"("auditId", "visitorToken");

-- AddForeignKey
ALTER TABLE "audit_feedback" ADD CONSTRAINT "audit_feedback_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
