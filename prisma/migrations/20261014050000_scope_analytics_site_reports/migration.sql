-- Preserve earlier observations without assigning them an invented hostname scope.
ALTER TABLE "site_connection_facts" ADD COLUMN "reportScope" JSONB;
ALTER TABLE "site_connection_facts" ADD COLUMN "activeUsers" INTEGER;
ALTER TABLE "site_connection_facts" ADD COLUMN "pageViews" INTEGER;
