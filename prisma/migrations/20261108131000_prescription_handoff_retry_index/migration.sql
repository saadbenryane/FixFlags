CREATE INDEX CONCURRENTLY "audits_prescription_handoff_due_idx"
ON "audits" ((COALESCE("prescriptionHandoffRetryAt", "completedAt")), id)
WHERE "includeAi" AND "aiReviewAt" IS NULL AND "triageAt" IS NOT NULL
  AND "completedAt" IS NOT NULL AND "userId" IS NOT NULL
  AND status IN ('COMPLETED', 'JUDGING');
