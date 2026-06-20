-- Drop STUDIO plan: migrate existing STUDIO users to TEAM
UPDATE "users" SET "plan" = 'TEAM' WHERE "plan" = 'STUDIO';

-- Drop STUDIO from the Plan enum
ALTER TYPE "Plan" RENAME TO "Plan_old";
CREATE TYPE "Plan" AS ENUM ('FREE', 'BUILDER', 'TEAM');
ALTER TABLE "users" ALTER COLUMN "plan" TYPE "Plan" USING "plan"::text::"Plan";
DROP TYPE "Plan_old";

-- Create CreditPurchaseStatus enum
CREATE TYPE "CreditPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'CANCELED', 'REFUNDED');

-- Create CreditPurchase model
CREATE TABLE "credit_purchases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "packId" TEXT NOT NULL,
    "creditsPurchased" INTEGER NOT NULL,
    "creditsRemaining" INTEGER NOT NULL,
    "priceUsdCents" INTEGER NOT NULL,
    "status" "CreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "credit_purchases_stripeSessionId_key" UNIQUE ("stripeSessionId")
);

CREATE INDEX "credit_purchases_userId_status_idx" ON "credit_purchases"("userId", "status");

ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
