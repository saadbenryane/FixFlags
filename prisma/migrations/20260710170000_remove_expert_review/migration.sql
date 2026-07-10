-- Remove the Expert Review add-on: drop its tables and enum.

-- DropForeignKey
ALTER TABLE "expert_review_deliverables" DROP CONSTRAINT "expert_review_deliverables_orderId_fkey";

-- DropForeignKey
ALTER TABLE "expert_review_events" DROP CONSTRAINT "expert_review_events_actorId_fkey";

-- DropForeignKey
ALTER TABLE "expert_review_events" DROP CONSTRAINT "expert_review_events_orderId_fkey";

-- DropForeignKey
ALTER TABLE "expert_review_orders" DROP CONSTRAINT "expert_review_orders_auditId_fkey";

-- DropForeignKey
ALTER TABLE "expert_review_orders" DROP CONSTRAINT "expert_review_orders_userId_fkey";

-- DropTable
DROP TABLE "expert_review_deliverables";

-- DropTable
DROP TABLE "expert_review_events";

-- DropTable
DROP TABLE "expert_review_orders";

-- DropEnum
DROP TYPE "ExpertReviewStatus";
