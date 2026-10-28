-- New auth users start without a preferred tool selection.
-- Preserve all existing profile values, including retained historical NULLs.
ALTER TABLE "users" ALTER COLUMN "preferredTools" SET DEFAULT ARRAY[]::TEXT[];
