-- CreateEnum
CREATE TYPE "RepoFixPrStatus" AS ENUM ('DRAFT', 'CREATING', 'CREATED', 'FAILED');

-- CreateTable
CREATE TABLE "repo_fix_prs" (
    "id" TEXT NOT NULL,
    "repoScanId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "baseSha" TEXT NOT NULL,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "status" "RepoFixPrStatus" NOT NULL DEFAULT 'DRAFT',
    "patchApplied" BOOLEAN NOT NULL DEFAULT false,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repo_fix_prs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "repo_fix_prs_findingId_key" ON "repo_fix_prs"("findingId");

-- CreateIndex
CREATE INDEX "repo_fix_prs_repoScanId_idx" ON "repo_fix_prs"("repoScanId");

-- CreateIndex
CREATE INDEX "repo_fix_prs_userId_idx" ON "repo_fix_prs"("userId");

-- AddForeignKey
ALTER TABLE "repo_fix_prs" ADD CONSTRAINT "repo_fix_prs_repoScanId_fkey" FOREIGN KEY ("repoScanId") REFERENCES "repo_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_fix_prs" ADD CONSTRAINT "repo_fix_prs_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "repo_scan_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repo_fix_prs" ADD CONSTRAINT "repo_fix_prs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
