-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "idToken" TEXT,
ADD COLUMN     "refreshTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "image" TEXT;
