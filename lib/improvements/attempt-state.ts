type AttemptState = { outcome: string | null; sourceAuditId?: string;
  verificationAudit?: { projectId: string | null; parentId: string | null; status: string;
    verifierExecutions?: Array<{ workKind?: string | null; workState?: string | null }> } | null }

/** Ready-to-verify records alone do not establish that a check was admitted. */
export function attemptHasActiveVerification(attempt: AttemptState | undefined, projectId: string, sourceAuditId?: string): boolean {
  const audit = attempt?.verificationAudit
  if (!attempt || attempt.outcome != null || !audit || audit.projectId !== projectId || audit.parentId !== attempt.sourceAuditId ||
    sourceAuditId && attempt.sourceAuditId !== sourceAuditId) return false
  if (['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING'].includes(audit.status)) return true
  return audit.status === 'COMPLETED' && Boolean(audit.verifierExecutions?.some(task => task.workKind === 'finalize' &&
    ['READY', 'RUNNING', 'RETRY_WAIT'].includes(task.workState ?? '')))
}
