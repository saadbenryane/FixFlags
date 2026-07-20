-- CreateEnum
CREATE TYPE "FixConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CauseCertainty" AS ENUM ('REPRODUCED', 'DETECTED', 'OBSERVED', 'LIKELY');

-- AlterTable
ALTER TABLE "flags" ADD COLUMN     "causeCertainty" "CauseCertainty",
ADD COLUMN     "fixConfidence" "FixConfidence";

-- AlterTable
ALTER TABLE "repo_scan_findings" ADD COLUMN     "windsurfPrompt" TEXT;
