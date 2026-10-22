-- Delivery accounting examines reservations, not the entire unclaimed backlog.
-- Terminal evidence and task input bodies are outside this bounded lane.
CREATE INDEX CONCURRENTLY "audit_verifier_delivery_window_idx"
  ON "audit_verifier_executions" ("workKind", "auditId")
  WHERE "targetKey" LIKE 'task:%' AND ("workState" = 'RUNNING' OR
    ("workState" = 'READY' AND ("workDispatchState" IN ('SENT', 'FAILED') OR "workDispatchLeaseUntil" IS NOT NULL)));
