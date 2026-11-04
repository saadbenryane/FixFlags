type AttemptSource = { sourceAuditId?: string; sourceFlagIds?: readonly string[]; handoffReference?: string | null }
type AttemptState = AttemptSource & { outcome: string | null;
  verificationAudit?: { projectId: string | null; parentId: string | null; status: string;
    verifierExecutions?: Array<{ workKind?: string | null; workState?: string | null }> } | null }

/** Frozen grouped membership wins. Legacy single-Flag handoffs cannot expand
 * to another observation merely because both came from the same Audit. */
export function attemptTargetsFlag(attempt: AttemptSource, sourceAuditId?: string, sourceFlagId?: string) {
  if (sourceFlagId && attempt.sourceFlagIds?.length) return attempt.sourceFlagIds.includes(sourceFlagId)
  if (sourceAuditId && attempt.sourceAuditId !== sourceAuditId) return false
  return !sourceFlagId || !attempt.handoffReference?.startsWith('flag:') || attempt.handoffReference === 'flag:' + sourceFlagId
}

/** Ready-to-verify records alone do not establish that a check was admitted. */
export function attemptHasActiveVerification(attempt: AttemptState | undefined, projectId: string, sourceAuditId?: string, sourceFlagId?: string): boolean {
  const audit = attempt?.verificationAudit
  if (!attempt || attempt.outcome != null || !audit || audit.projectId !== projectId || audit.parentId !== attempt.sourceAuditId) return false
  // Grouped repairs retain captures from several source Audits. The frozen
  // selection scopes their activity; later incident peers cannot inherit it.
  if (!attemptTargetsFlag(attempt, sourceAuditId, sourceFlagId)) return false
  if (['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING'].includes(audit.status)) return true
  return audit.status === 'COMPLETED' && Boolean(audit.verifierExecutions?.some(task => task.workKind === 'finalize' &&
    ['READY', 'RUNNING', 'RETRY_WAIT'].includes(task.workState ?? '')))
}

/** A durable Improvement can have several occurrences. Proof belongs to the
 * recorded source and completed verification, not every later occurrence. */
export function attemptProvesFlagRecovery(attempt: {
  outcome: string | null; comparable: boolean | null; sourceAuditId: string;
  sourceFlagIds?: readonly string[]; handoffReference?: string | null; verificationAuditId: string | null;
  verificationAudit?: { id: string; projectId: string | null; parentId: string | null; status: string } | null;
}, projectId: string, sourceAuditId: string, sourceFlagId: string): boolean {
  const proof = attempt.verificationAudit
  return attempt.outcome === 'IMPROVED' && attempt.comparable === true && attemptTargetsFlag(attempt, sourceAuditId, sourceFlagId) &&
    Boolean(proof && proof.id === attempt.verificationAuditId && proof.projectId === projectId &&
      proof.parentId === attempt.sourceAuditId && proof.status === 'COMPLETED')
}
