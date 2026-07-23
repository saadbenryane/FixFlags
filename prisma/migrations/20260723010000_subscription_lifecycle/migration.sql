CREATE TYPE "SubscriptionLifecycleType" AS ENUM (
  'SUBSCRIPTION_CREATED',
  'SUBSCRIPTION_UPDATED',
  'SUBSCRIPTION_DELETED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED'
);

CREATE TABLE "subscription_lifecycle_events" (
  "id" TEXT NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "stripeEventType" TEXT NOT NULL,
  "type" "SubscriptionLifecycleType" NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "customerId" TEXT,
  "previousPlan" "Plan",
  "plan" "Plan" NOT NULL,
  "status" "SubscriptionStatus" NOT NULL,
  "priceId" TEXT,
  "unitAmount" INTEGER,
  "currency" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_lifecycle_events_stripeEventId_key"
  ON "subscription_lifecycle_events"("stripeEventId");
CREATE INDEX "subscription_lifecycle_events_userId_occurredAt_idx"
  ON "subscription_lifecycle_events"("userId", "occurredAt");
CREATE INDEX "subscription_lifecycle_events_type_occurredAt_idx"
  ON "subscription_lifecycle_events"("type", "occurredAt");
CREATE INDEX "subscription_lifecycle_events_status_occurredAt_idx"
  ON "subscription_lifecycle_events"("status", "occurredAt");
ALTER TABLE "subscription_lifecycle_events"
  ADD CONSTRAINT "subscription_lifecycle_events_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
