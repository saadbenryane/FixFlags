-- Preview/staging scan access credentials (encrypted at rest).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scan_access_encrypted" TEXT;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "scan_access_encrypted" TEXT;
