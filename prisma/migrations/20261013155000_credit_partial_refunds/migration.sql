ALTER TABLE "credit_purchases" ADD COLUMN "creditsRefunded" INTEGER NOT NULL DEFAULT 0;
UPDATE "credit_purchases" SET "creditsRefunded"="creditsPurchased" WHERE status='REFUNDED';
CREATE UNIQUE INDEX "admin_operation_unsettled_target" ON "admin_operations"("targetType","targetId") WHERE status IN ('QUEUED','RUNNING','INDETERMINATE');
