ALTER TABLE "projects" ADD COLUMN "accountChecksEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "accountCheckRevision" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "site_test_accounts" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "origin" TEXT NOT NULL,
 "purpose" TEXT NOT NULL, "email" TEXT NOT NULL, "encryptedPassword" TEXT NOT NULL,
 "encryptedSession" TEXT, "signupUrl" TEXT NOT NULL, "loginUrl" TEXT, "homeUrl" TEXT,
 "flowFingerprint" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'RESERVED', "operationId" TEXT,
 "submittedAt" TIMESTAMP(3), "signupVerifiedAt" TIMESTAMP(3), "deletionVerifiedAt" TIMESTAMP(3),
 "lastCheckedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "site_test_accounts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "site_test_accounts_email_key" ON "site_test_accounts"("email");
CREATE UNIQUE INDEX "site_test_accounts_projectId_origin_purpose_key" ON "site_test_accounts"("projectId", "origin", "purpose");
CREATE INDEX "site_test_accounts_projectId_state_idx" ON "site_test_accounts"("projectId", "state");
CREATE TABLE "site_account_messages" (
 "id" TEXT PRIMARY KEY, "providerId" TEXT NOT NULL, "accountId" TEXT NOT NULL,
 "encryptedVerification" TEXT NOT NULL, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "site_account_messages_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "site_test_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "site_account_messages_providerId_key" ON "site_account_messages"("providerId");
CREATE INDEX "site_account_messages_accountId_expiresAt_idx" ON "site_account_messages"("accountId", "expiresAt");
CREATE TABLE "site_account_check_receipts" (
 "id" TEXT PRIMARY KEY, "projectId" TEXT NOT NULL, "auditId" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "state" TEXT NOT NULL, "detail" TEXT NOT NULL, "pageUrl" TEXT NOT NULL,
 "evidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "site_account_check_receipts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "site_account_check_receipts_auditId_kind_pageUrl_key" ON "site_account_check_receipts"("auditId", "kind", "pageUrl");
CREATE INDEX "site_account_check_receipts_projectId_createdAt_idx" ON "site_account_check_receipts"("projectId", "createdAt");
