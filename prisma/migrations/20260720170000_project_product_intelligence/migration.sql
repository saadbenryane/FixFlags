-- AlterTable
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "productIntelligence" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_userId_url_idx" ON "projects"("userId", "url");
