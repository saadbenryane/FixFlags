ALTER TABLE "audits"
ALTER COLUMN "isPublic" SET DEFAULT true;

UPDATE "audits"
SET "isPublic" = true
WHERE "isPublic" = false;
