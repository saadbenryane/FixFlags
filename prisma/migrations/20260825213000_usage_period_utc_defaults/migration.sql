ALTER TABLE "users"
ALTER COLUMN "usagePeriodStart" SET DEFAULT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
ALTER COLUMN "usagePeriodEnd" SET DEFAULT date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + interval '1 month';
