-- Add scan access credential columns (encrypted at rest).
ALTER TABLE "projects" ADD COLUMN "scanAccessEncrypted" TEXT;
ALTER TABLE "audits" ADD COLUMN "scanAccessEncrypted" TEXT;
