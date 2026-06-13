-- CreateIndex
CREATE INDEX "audits_status_updatedAt_idx" ON "audits"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "audits_userId_status_idx" ON "audits"("userId", "status");

-- CreateIndex
CREATE INDEX "audits_parentId_idx" ON "audits"("parentId");

-- CreateIndex
CREATE INDEX "findings_auditId_checkId_idx" ON "findings"("auditId", "checkId");
