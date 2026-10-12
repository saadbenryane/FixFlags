import { createHash } from 'node:crypto'
import { canonicalIntent } from '@/lib/sites/domain/execution-spec'

export type AttemptIntent = {
  userId: string; sourceAuditId: string; handoffReference?: string | null;
  pullRequestReference?: string | null; commitReference?: string | null;
  deploymentReference?: string | null; changeSummary?: string | null;
}
export const normalizedAttemptValue = (value?: string | null) => value?.trim() || null

/** Transport and presentation may change on a retry; the declared repair cannot. */
export function attemptIntentHash(input: AttemptIntent) {
  return createHash('sha256').update(canonicalIntent({ userId: input.userId, sourceAuditId: input.sourceAuditId,
    handoffReference: normalizedAttemptValue(input.handoffReference), pullRequestReference: normalizedAttemptValue(input.pullRequestReference),
    commitReference: normalizedAttemptValue(input.commitReference), deploymentReference: normalizedAttemptValue(input.deploymentReference),
    changeSummary: normalizedAttemptValue(input.changeSummary) })).digest('hex')
}
export function assertAttemptReplay(input: AttemptIntent, recorded: { requestHash?: string | null }) {
  // Historical requests never captured this hash. Preserve their receipt
  // without inventing a new fix or pretending to reconstruct their payload.
  if (recorded.requestHash && recorded.requestHash !== attemptIntentHash(input)) throw new ImprovementAttemptConflict()
}

export class ImprovementAttemptConflict extends Error {
  readonly status = 409
  readonly code = 'FIX_INTENT_MISMATCH'
  constructor() { super('This request key belongs to a different recorded fix.'); this.name = 'ImprovementAttemptConflict' }
}
