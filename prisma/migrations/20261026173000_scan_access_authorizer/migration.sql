-- Retained access decisions keep the owner baseline at migration time.
-- This does not reconstruct who originally supplied historical credentials.
ALTER TABLE "projects" ADD COLUMN "scanAccessAuthorizedByUserId" TEXT;

UPDATE "projects" SET "scanAccessAuthorizedByUserId" = "userId"
WHERE "scanAccessEncrypted" IS NOT NULL;

CREATE INDEX "projects_scanAccessAuthorizedByUserId_idx"
ON "projects"("scanAccessAuthorizedByUserId");

ALTER TABLE "projects"
ADD CONSTRAINT "projects_scanAccessAuthorizedByUserId_fkey"
FOREIGN KEY ("scanAccessAuthorizedByUserId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
