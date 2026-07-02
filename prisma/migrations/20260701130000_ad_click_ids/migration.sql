-- AlterTable
ALTER TABLE "audits" ADD COLUMN "gclid" TEXT,
ADD COLUMN "fbclid" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "gclid" TEXT,
ADD COLUMN "fbclid" TEXT;
