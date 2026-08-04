-- AlterTable
ALTER TABLE "paid_plan_waitlist_entries" ADD COLUMN     "discountTier" INTEGER,
ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "paid_plan_waitlist_entries_plan_discountTier_idx" ON "paid_plan_waitlist_entries"("plan", "discountTier");

-- Backfill captured email from the account email for existing rows.
UPDATE "paid_plan_waitlist_entries" e
SET "email" = u."email"
FROM "users" u
WHERE e."userId" = u."id" AND e."email" IS NULL;

-- Backfill discount tiers for existing members by join order per plan,
-- matching the runtime rule (positions 1..500 -> tier 1, 501..1000 -> tier 2).
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "plan"
      ORDER BY "joinedAt" ASC, "id" ASC
    ) AS position
  FROM "paid_plan_waitlist_entries"
)
UPDATE "paid_plan_waitlist_entries" e
SET "discountTier" = CASE
  WHEN r.position <= 500 THEN 1
  WHEN r.position <= 1000 THEN 2
  ELSE NULL
END
FROM ranked r
WHERE e."id" = r.id;
