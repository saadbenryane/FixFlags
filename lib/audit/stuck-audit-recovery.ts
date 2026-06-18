export type StuckAuditRecoveryAction = 'requeue' | 'force_fail'

export interface StuckAuditRecoveryInput {
  status: string
  jobState: string | null
}

export function resolveStuckAuditRecovery(
  input: StuckAuditRecoveryInput
): StuckAuditRecoveryAction {
  if (input.status === 'QUEUED' && input.jobState !== 'active') {
    return 'requeue'
  }
  return 'force_fail'
}

export function stuckAuditCutoff(nowMs = Date.now(), stuckMinutes = 15): Date {
  return new Date(nowMs - stuckMinutes * 60 * 1000)
}

export function isAuditStuck(updatedAt: Date, nowMs = Date.now(), stuckMinutes = 15): boolean {
  return updatedAt.getTime() < stuckAuditCutoff(nowMs, stuckMinutes).getTime()
}
