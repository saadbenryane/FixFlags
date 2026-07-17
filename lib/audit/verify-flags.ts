import { DeterministicFlag } from './checks'
import { verifiableCheckIds } from './verification-rules'
import { diffFlagsAgainstParent } from './diff-flags'

export {
  allCheckIdsHaveVerificationRules,
  verificationRuleForCheckId,
} from './verification-rules'

const VERIFIABLE_CHECK_IDS = new Set(verifiableCheckIds())

function currentVerifiableCheckIds(flags: DeterministicFlag[]): Set<string> {
  return new Set(
    flags.filter((f) => VERIFIABLE_CHECK_IDS.has(f.checkId)).map((f) => f.checkId)
  )
}

/** True when a parent flag checkId still fails on monitoring (used in tests). */
export function isCheckStillFailing(checkId: string, currentCheckIds: Set<string>): boolean {
  return currentCheckIds.has(checkId)
}

/** Build current check IDs from deterministic audit output (used in tests). */
export function buildCurrentVerifiableCheckIds(flags: DeterministicFlag[]): Set<string> {
  return currentVerifiableCheckIds(flags)
}

/**
 * Sync FIXED / REGRESSED / OPEN statuses from the child's own fresh flags vs parent.
 * Re-checks run FULL capture + checks in the main pipeline; this must never start a
 * second Puppeteer / deterministic-audit sidecar.
 *
 * `@deprecated` Prefer calling `diffFlagsAgainstParent` directly from finalize.
 * Kept as a thin alias for callers that still pass a URL argument.
 */
export async function applyDeterministicVerification(
  monitoringAuditId: string,
  parentAuditId: string,
  // URL retained for call-site compatibility; verification uses persisted child flags.
  url?: string
): Promise<void> {
  void url
  await diffFlagsAgainstParent(monitoringAuditId, parentAuditId)
}

export type { DeterministicFlag }
