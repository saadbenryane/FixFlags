-- Preserve retained grants under the ownership baseline at migration time.
-- This cannot reconstruct the original authorizer of historical connections.
ALTER TABLE "site_connections" ADD COLUMN "authorizedByUserId" TEXT;

UPDATE "site_connections" c
SET "authorizedByUserId" = p."userId"
FROM "projects" p
WHERE p.id = c."projectId";

CREATE INDEX "site_connections_authorizedByUserId_idx"
ON "site_connections"("authorizedByUserId");

ALTER TABLE "site_connections"
ADD CONSTRAINT "site_connections_authorizedByUserId_fkey"
FOREIGN KEY ("authorizedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
