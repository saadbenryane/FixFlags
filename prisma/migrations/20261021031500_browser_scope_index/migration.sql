-- Browser scope reads need URL intent, not every evaluator and receipt row.
-- Keep this concurrent build alone, outside an explicit transaction.
CREATE INDEX CONCURRENTLY "audit_verifier_browser_scope_idx"
  ON "audit_verifier_executions" ("auditId")
  WHERE "workKind" = 'browser' AND "targetKey" LIKE 'task:%' AND "pageUrl" IS NOT NULL;
