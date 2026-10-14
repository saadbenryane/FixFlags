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

/** A durable Improvement can have several occurrences. Proof belongs to the
 * recorded source and completed verification, not every later occurrence. */
export function attemptProvesFlagRecovery(attempt: {
  outcome: string | null; comparable: boolean | null; sourceAuditId: string;
  handoffReference?: string | null; verificationAuditId: string | null;
  verificationAudit?: { id: string; projectId: string | null; parentId: string | null; status: string } | null;
}, projectId: string, sourceAuditId: string, sourceFlagId: string): boolean {
  const proof = attempt.verificationAudit
  return attempt.outcome === 'IMPROVED' && attempt.comparable === true && attempt.sourceAuditId === sourceAuditId &&
    (!attempt.handoffReference?.startsWith('flag:') || attempt.handoffReference === 'flag:' + sourceFlagId) &&
    Boolean(proof && proof.id === attempt.verificationAuditId && proof.projectId === projectId &&
      proof.parentId === sourceAuditId && proof.status === 'COMPLETED')
}
