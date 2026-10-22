-- Retire unused historical columns without deleting stored credentials.
-- The legacy manual-resolve receipt remains unchanged.
DO $retire_unused_scan_access$
DECLARE
  legacy_table TEXT;
  has_values BOOLEAN;
BEGIN
  PERFORM set_config('lock_timeout', '10s', true);
  LOCK TABLE "projects", "audits" IN ACCESS EXCLUSIVE MODE;

  FOREACH legacy_table IN ARRAY ARRAY['projects', 'audits'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = legacy_table
        AND column_name = 'scan_access_encrypted'
    ) THEN
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM %I WHERE scan_access_encrypted IS NOT NULL)',
        legacy_table
      ) INTO has_values;
      IF has_values THEN
        RAISE EXCEPTION 'LEGACY_SCAN_ACCESS_HAS_VALUES: %. Preserve the encrypted credentials before retirement.', legacy_table;
      END IF;
    END IF;
  END LOOP;

  ALTER TABLE "projects" DROP COLUMN IF EXISTS "scan_access_encrypted";
  ALTER TABLE "audits" DROP COLUMN IF EXISTS "scan_access_encrypted";
END
$retire_unused_scan_access$;
