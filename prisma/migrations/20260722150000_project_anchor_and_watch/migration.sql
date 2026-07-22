-- AlterTable
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "isAnchor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "watchInterval" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "watchNextRunAt" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "watchLastRunAt" TIMESTAMP(3);
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "watchNotifiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "projects_watchNextRunAt_idx" ON "projects"("watchNextRunAt");
CREATE UNIQUE INDEX IF NOT EXISTS "projects_userId_url_anchor_key"
ON "projects"("userId", "url")
WHERE "isAnchor" = true;

-- Revoke pre-hash password links instead of retaining a plaintext verifier.
UPDATE "share_links"
SET "revoked" = true
WHERE "password" IS NOT NULL
  AND "password" NOT LIKE 'scrypt$%';
