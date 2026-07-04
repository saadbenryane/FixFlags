-- Add updatedAt column to verifications table (required by better-auth v1.6+)
ALTER TABLE "verifications" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
