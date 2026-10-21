-- Page and behavior responsibility reads share the admitted-task lane.
-- Keep URL values outside B-tree keys, and build without blocking ordinary writes.
CREATE INDEX CONCURRENTLY "audit_verifier_admitted_scope_idx"
  ON "audit_verifier_executions" ("auditId", "workKind")
  WHERE "workKind" IN ('browser', 'flow', 'slow-replay', 'journeys')
    AND "targetKey" LIKE 'task:%' AND "pageUrl" IS NOT NULL;
