-- Add scan access credential columns (encrypted at rest).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "scanAccessEncrypted" TEXT;
ALTER TABLE "audits" ADD COLUMN IF NOT EXISTS "scanAccessEncrypted" TEXT;

-- Migrate legacy snake_case columns when present from earlier migration drafts.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'scan_access_encrypted'
  ) THEN
    UPDATE "projects"
    SET "scanAccessEncrypted" = "scan_access_encrypted"
    WHERE "scanAccessEncrypted" IS NULL
      AND "scan_access_encrypted" IS NOT NULL;
    ALTER TABLE "projects" DROP COLUMN "scan_access_encrypted";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audits'
      AND column_name = 'scan_access_encrypted'
  ) THEN
    UPDATE "audits"
    SET "scanAccessEncrypted" = "scan_access_encrypted"
    WHERE "scanAccessEncrypted" IS NULL
      AND "scan_access_encrypted" IS NOT NULL;
    ALTER TABLE "audits" DROP COLUMN "scan_access_encrypted";
  END IF;
END $$;
