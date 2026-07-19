import { DeterministicFlag } from './checks'
import { verifiableCheckIds } from './verification-rules'

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

export type { DeterministicFlag }
