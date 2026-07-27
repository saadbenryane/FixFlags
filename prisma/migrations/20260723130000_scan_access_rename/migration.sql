/*
  Warnings:

  - You are about to drop the column `scan_access_encrypted` on the `audits` table. All the data in the column will be lost.
  - You are about to drop the column `scan_access_encrypted` on the `projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "audits" DROP COLUMN "scan_access_encrypted",
ADD COLUMN     "scanAccessEncrypted" TEXT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "scan_access_encrypted",
ADD COLUMN     "scanAccessEncrypted" TEXT;
