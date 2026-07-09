-- AlterTable
ALTER TABLE "audit_pages" ADD COLUMN     "pageId" TEXT;

-- AlterTable
ALTER TABLE "audits" ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "flags" ADD COLUMN     "issueId" TEXT;

-- AlterTable
ALTER TABLE "verifications" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "graph_site" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "rootUrl" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAuditedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auditCount" INTEGER NOT NULL DEFAULT 0,
    "industryGuess" TEXT,
    "techGuess" JSONB,
    "industryId" TEXT,

    CONSTRAINT "graph_site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_page" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_technology" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "graph_technology_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_site_technology" (
    "siteId" TEXT NOT NULL,
    "technologyId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "graph_site_technology_pkey" PRIMARY KEY ("siteId","technologyId")
);

-- CreateTable
CREATE TABLE "graph_industry" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "graph_industry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_issue" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "rubric" TEXT NOT NULL,
    "problemTemplate" TEXT NOT NULL,
    "fixTemplate" TEXT NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "siteCount" INTEGER NOT NULL DEFAULT 0,
    "frameworkCount" INTEGER NOT NULL DEFAULT 0,
    "examples" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_issue_occurrence" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "flagId" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_issue_occurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_fix_prompt" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_fix_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_benchmark_snapshot" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleSize" INTEGER NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "p25Score" DOUBLE PRECISION NOT NULL,
    "p50Score" DOUBLE PRECISION NOT NULL,
    "p75Score" DOUBLE PRECISION NOT NULL,
    "flagFrequency" JSONB NOT NULL,
    "topIssues" JSONB NOT NULL,
    "topIssueId" TEXT,

    CONSTRAINT "graph_benchmark_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_experiment" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metric" TEXT NOT NULL,
    "baseline" DOUBLE PRECISION,
    "result" DOUBLE PRECISION,
    "decision" TEXT,
    "notes" TEXT,

    CONSTRAINT "graph_experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_tool_usage" (
    "id" TEXT NOT NULL,
    "toolSlug" TEXT NOT NULL,
    "inputHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "sessionId" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_tool_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "graph_artifact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "writtenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graph_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "graph_site_hostname_key" ON "graph_site"("hostname");

-- CreateIndex
CREATE INDEX "graph_site_lastAuditedAt_idx" ON "graph_site"("lastAuditedAt");

-- CreateIndex
CREATE INDEX "graph_page_siteId_idx" ON "graph_page"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "graph_page_siteId_url_key" ON "graph_page"("siteId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "graph_technology_name_key" ON "graph_technology"("name");

-- CreateIndex
CREATE INDEX "graph_site_technology_technologyId_idx" ON "graph_site_technology"("technologyId");

-- CreateIndex
CREATE UNIQUE INDEX "graph_industry_slug_key" ON "graph_industry"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "graph_issue_fingerprint_key" ON "graph_issue"("fingerprint");

-- CreateIndex
CREATE INDEX "graph_issue_checkId_idx" ON "graph_issue"("checkId");

-- CreateIndex
CREATE INDEX "graph_issue_rubric_idx" ON "graph_issue"("rubric");

-- CreateIndex
CREATE INDEX "graph_issue_occurrenceCount_idx" ON "graph_issue"("occurrenceCount");

-- CreateIndex
CREATE UNIQUE INDEX "graph_issue_occurrence_flagId_key" ON "graph_issue_occurrence"("flagId");

-- CreateIndex
CREATE INDEX "graph_issue_occurrence_issueId_idx" ON "graph_issue_occurrence"("issueId");

-- CreateIndex
CREATE INDEX "graph_issue_occurrence_siteId_idx" ON "graph_issue_occurrence"("siteId");

-- CreateIndex
CREATE INDEX "graph_fix_prompt_issueId_idx" ON "graph_fix_prompt"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "graph_fix_prompt_issueId_tool_key" ON "graph_fix_prompt"("issueId", "tool");

-- CreateIndex
CREATE INDEX "graph_benchmark_snapshot_scope_takenAt_idx" ON "graph_benchmark_snapshot"("scope", "takenAt");

-- CreateIndex
CREATE UNIQUE INDEX "graph_experiment_slug_key" ON "graph_experiment"("slug");

-- CreateIndex
CREATE INDEX "graph_experiment_surface_startedAt_idx" ON "graph_experiment"("surface", "startedAt");

-- CreateIndex
CREATE INDEX "graph_tool_usage_toolSlug_createdAt_idx" ON "graph_tool_usage"("toolSlug", "createdAt");

-- CreateIndex
CREATE INDEX "graph_tool_usage_source_createdAt_idx" ON "graph_tool_usage"("source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "graph_artifact_path_key" ON "graph_artifact"("path");

-- CreateIndex
CREATE INDEX "graph_artifact_kind_writtenAt_idx" ON "graph_artifact"("kind", "writtenAt");

-- CreateIndex
CREATE INDEX "audits_siteId_idx" ON "audits"("siteId");

-- CreateIndex
CREATE INDEX "flags_issueId_idx" ON "flags"("issueId");

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "graph_site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_pages" ADD CONSTRAINT "audit_pages_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "graph_page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flags" ADD CONSTRAINT "flags_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "graph_issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_site" ADD CONSTRAINT "graph_site_industryId_fkey" FOREIGN KEY ("industryId") REFERENCES "graph_industry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_page" ADD CONSTRAINT "graph_page_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "graph_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_site_technology" ADD CONSTRAINT "graph_site_technology_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "graph_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_site_technology" ADD CONSTRAINT "graph_site_technology_technologyId_fkey" FOREIGN KEY ("technologyId") REFERENCES "graph_technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_issue_occurrence" ADD CONSTRAINT "graph_issue_occurrence_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "graph_issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_issue_occurrence" ADD CONSTRAINT "graph_issue_occurrence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "graph_site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_fix_prompt" ADD CONSTRAINT "graph_fix_prompt_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "graph_issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "graph_benchmark_snapshot" ADD CONSTRAINT "graph_benchmark_snapshot_topIssueId_fkey" FOREIGN KEY ("topIssueId") REFERENCES "graph_issue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
