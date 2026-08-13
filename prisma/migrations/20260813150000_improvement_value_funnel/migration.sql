CREATE TYPE "ImprovementRejectionReason" AS ENUM (
  'WRONG',
  'ALREADY_KNOWN',
  'LOW_IMPACT',
  'POOR_TIMING',
  'TOO_COSTLY',
  'WEAK_RECOMMENDATION',
  'MISUNDERSTOOD_PRODUCT_CONTEXT'
);

ALTER TABLE "improvements"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "acceptedByChannel" TEXT,
ADD COLUMN "rejectionReason" "ImprovementRejectionReason",
ADD COLUMN "rejectionNote" TEXT,
ADD COLUMN "rejectedAt" TIMESTAMP(3);

ALTER TABLE "flag_feedback"
ADD COLUMN "reason" "ImprovementRejectionReason";

CREATE INDEX "improvements_acceptedAt_idx" ON "improvements"("acceptedAt");
CREATE INDEX "improvements_rejectionReason_idx" ON "improvements"("rejectionReason");
