ALTER TABLE "users"
ADD COLUMN "stripeCurrentPeriodStart" TIMESTAMP(3),
ADD COLUMN "usagePeriodStart" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('month', CURRENT_TIMESTAMP),
ADD COLUMN "usagePeriodEnd" TIMESTAMP(3) NOT NULL DEFAULT date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month';

COMMENT ON COLUMN "users"."usagePeriodStart" IS 'Inclusive start of the active Product Review and deep-review usage period.';
COMMENT ON COLUMN "users"."usagePeriodEnd" IS 'Exclusive end of the active Product Review and deep-review usage period.';
