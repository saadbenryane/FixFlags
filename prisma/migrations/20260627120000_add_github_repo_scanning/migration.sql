-- CreateEnum
CREATE TYPE "RepoScanStatus" AS ENUM ('QUEUED', 'CLONING', 'SCANNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUserId" TEXT NOT NULL,
    "githubLogin" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "selectedRepos" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubConnectionId" TEXT NOT NULL,
    "repoFullName" TEXT NOT NULL,
    "commitSha" TEXT,
    "status" "RepoScanStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMsg" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repo_scan_findings" (
    "id" TEXT NOT NULL,
    "repoScanId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "category" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineStart" INTEGER,
    "lineEnd" INTEGER,
    "problem" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    "fix" TEXT NOT NULL,
    "agentPrompt" TEXT,
    "cursorPrompt" TEXT,
    "claudePrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_scan_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_userId_key" ON "github_connections"("userId");

-- CreateIndex
CREATE INDEX "repo_scans_userId_createdAt_idx" ON "repo_scans"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "repo_scans_githubConnectionId_idx" ON "repo_scans"("githubConnectionId");

-- CreateIndex
CREATE INDEX "repo_scan_findings_repoScanId_idx" ON "repo_scan_findings"("repoScanId");

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_scans" ADD CONSTRAINT "repo_scans_githubConnectionId_fkey" FOREIGN KEY ("githubConnectionId") REFERENCES "github_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_scan_findings" ADD CONSTRAINT "repo_scan_findings_repoScanId_fkey" FOREIGN KEY ("repoScanId") REFERENCES "repo_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
