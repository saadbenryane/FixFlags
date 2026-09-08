-- Site board private entities (customer Site packaging). Not graph_site/graph_page.

CREATE TABLE IF NOT EXISTS "provisional_sites" (
    "id" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "canonicalHost" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "primaryAuditId" TEXT,
    "claimedProjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "provisional_sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_pages" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "provisionalSiteId" TEXT,
    "url" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_outcomes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "provisionalSiteId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "inferenceSource" TEXT NOT NULL DEFAULT 'heuristic',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "site_outcomes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "site_outcome_pages" (
    "outcomeId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    CONSTRAINT "site_outcome_pages_pkey" PRIMARY KEY ("outcomeId","pageId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "provisional_sites_sessionKey_canonicalHost_key" ON "provisional_sites"("sessionKey", "canonicalHost");
CREATE INDEX IF NOT EXISTS "provisional_sites_primaryAuditId_idx" ON "provisional_sites"("primaryAuditId");
CREATE INDEX IF NOT EXISTS "provisional_sites_claimedProjectId_idx" ON "provisional_sites"("claimedProjectId");

CREATE UNIQUE INDEX IF NOT EXISTS "site_pages_projectId_url_key" ON "site_pages"("projectId", "url");
CREATE UNIQUE INDEX IF NOT EXISTS "site_pages_provisionalSiteId_url_key" ON "site_pages"("provisionalSiteId", "url");
CREATE INDEX IF NOT EXISTS "site_pages_projectId_idx" ON "site_pages"("projectId");
CREATE INDEX IF NOT EXISTS "site_pages_provisionalSiteId_idx" ON "site_pages"("provisionalSiteId");

CREATE UNIQUE INDEX IF NOT EXISTS "site_outcomes_projectId_slug_key" ON "site_outcomes"("projectId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "site_outcomes_provisionalSiteId_slug_key" ON "site_outcomes"("provisionalSiteId", "slug");
CREATE INDEX IF NOT EXISTS "site_outcomes_projectId_idx" ON "site_outcomes"("projectId");
CREATE INDEX IF NOT EXISTS "site_outcomes_provisionalSiteId_idx" ON "site_outcomes"("provisionalSiteId");

ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_provisionalSiteId_fkey" FOREIGN KEY ("provisionalSiteId") REFERENCES "provisional_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_outcomes" ADD CONSTRAINT "site_outcomes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_outcomes" ADD CONSTRAINT "site_outcomes_provisionalSiteId_fkey" FOREIGN KEY ("provisionalSiteId") REFERENCES "provisional_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_outcome_pages" ADD CONSTRAINT "site_outcome_pages_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "site_outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_outcome_pages" ADD CONSTRAINT "site_outcome_pages_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "site_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
