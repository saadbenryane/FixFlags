-- Append the receipt's task link to the existing read-only projection.
-- Existing columns and their order remain compatible with older readers.
CREATE OR REPLACE VIEW "audit_execution_evidence" AS
SELECT 'receipt'::TEXT AS "recordKind", NULL::"AuditWorkState" AS "workState",
       NULL::TEXT AS "workKind", ARRAY[]::TEXT[] AS "workDependencies",
       NULL::JSONB AS "workInput", NULL::JSONB AS "workResult", NULL::TEXT AS "workToken",
       NULL::INTEGER AS "workGeneration", NULL::INTEGER AS "workAttempts",
       NULL::TIMESTAMP(3) AS "workLeaseUntil", NULL::TIMESTAMP(3) AS "workRetryAt",
       NULL::TIMESTAMP(3) AS "workRecoveryUntil", NULL::TEXT AS "workErrorCode",
       NULL::"AuditDispatchState" AS "workDispatchState", NULL::TIMESTAMP(3) AS "workDispatchLeaseUntil",
       "checkVersion", "executionGeneration", "id", "auditId", "targetKey", "source",
       "checkId", "pageUrl", "scopeKey", "status", "evidenceReference", "detail",
       "createdAt", "updatedAt", "taskId"
FROM "audit_verifier_executions"
UNION ALL
SELECT 'task'::TEXT AS "recordKind", "workState", "workKind", "workDependencies",
       "workInput", "workResult", "workToken", "workGeneration", "workAttempts",
       "workLeaseUntil", "workRetryAt", "workRecoveryUntil", "workErrorCode",
       "workDispatchState", "workDispatchLeaseUntil", "checkVersion", "executionGeneration",
       "id", "auditId", "targetKey", "source", "checkId", "pageUrl", "scopeKey",
       "status", "evidenceReference", "detail", "createdAt", "updatedAt", NULL::TEXT AS "taskId"
FROM "audit_execution_tasks";
