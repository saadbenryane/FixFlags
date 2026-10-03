import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

export type FlagProofAudit = {
  id: string
  status: string
  completedAt: string | null
  createdAt: string | null
}

export type FlagResolutionInput = {
  status: string
  resolvedInId: string | null
  /** Completed verification audit from an IMPROVED attempt, used only when the Flag recorded no resolvedInId. */
  attemptProofId?: string | null
  sourceAuditId: string | null
  verifying: boolean
  proof: FlagProofAudit | null
}

export type FlagProofNote = {
  observedAt: string
  auditId: string
  showAuditId: boolean
  observation: string
}

export type FlagResolution =
  | { kind: 'open'; statusLabel: string }
  | { kind: 'verifying'; statusLabel: string; proof: FlagProofNote | null; runningNote: string }
  | { kind: 'proven'; statusLabel: string; proof: FlagProofNote }
  | { kind: 'unproven'; statusLabel: string; body: string; nextStep: 'verify' }

/**
 * The Flag detail page shows the improvement status when one is linked.
 * That value is PROPOSED until a check improves it to VERIFIED. The flag-row
 * status, including FIXED, is only the fallback.
 */
export function siteFlagDetailStatus(
  improvementStatus: string | null | undefined,
  flagStatus: string,
): string {
  return improvementStatus ?? flagStatus
}

const STILL_OPEN = new Set(['OPEN', 'REGRESSED', 'IGNORED'])

/**
 * The audit id a recovery may cite. Pass attempts newest first, matching
 * loadSiteFlagDetail. The Flag's own resolvedInId wins. When that is absent,
 * a VERIFIED improvement may cite the newest comparable IMPROVED attempt.
 */
export function flagRecoveryProofId(input: {
  status: string
  resolvedInId: string | null
  attempts: Array<{ outcome: string | null; comparable: boolean | null; verificationAuditId: string | null }>
}): string | null {
  if (input.resolvedInId) return input.resolvedInId
  if (input.status !== 'VERIFIED') return null
  const improved = input.attempts.find(
    (attempt) =>
      attempt.outcome === 'IMPROVED' &&
      attempt.comparable === true &&
      typeof attempt.verificationAuditId === 'string' &&
      attempt.verificationAuditId.length > 0,
  )
  return improved?.verificationAuditId ?? null
}

function proofNote(input: FlagResolutionInput): FlagProofNote | null {
  const proof = input.proof
  const proofId = input.resolvedInId ?? (input.status === 'VERIFIED' ? input.attemptProofId ?? null : null)
  if (!proofId || !proof) return null
  if (proof.id !== proofId) return null
  if (proof.status !== 'COMPLETED') return null
  const raw = proof.completedAt ?? proof.createdAt
  if (!raw) return null
  const observed = new Date(raw)
  if (Number.isNaN(observed.getTime())) return null
  return {
    observedAt: observed.toISOString(),
    auditId: proof.id,
    showAuditId: proof.id !== input.sourceAuditId,
    observation: SITE_BOARD_COPY.flagProofObserved,
  }
}

/**
 * What the Flag page may say about recovery.
 *
 * Recovered requires a completed proof audit. The id is the Flag's resolvedInId,
 * or, only when that is absent and the loaded status is VERIFIED, the improved
 * attempt's verification audit. The detail status is often PROPOSED or VERIFIED,
 * so the proof is not limited to the flag-row value FIXED. An open, regressed,
 * or ignored Flag stays open even if a proof object is passed in. A recorded
 * proof id, or a VERIFIED status, without a completed match, is unverified.
 * Verifying is only the persisted attempt that has not finished, and it keeps
 * the last completed check visible.
 */
export function flagResolutionView(input: FlagResolutionInput): FlagResolution {
  const stillOpen = STILL_OPEN.has(input.status)
  const proof = stillOpen ? null : proofNote(input)
  if (input.verifying) {
    return {
      kind: 'verifying',
      statusLabel: SITE_BOARD_COPY.verifying,
      proof,
      runningNote: SITE_BOARD_COPY.flagProofRunning,
    }
  }
  if (proof) {
    return { kind: 'proven', statusLabel: SITE_BOARD_COPY.flagRecovered, proof }
  }
  if (!stillOpen && (input.status === 'FIXED' || input.status === 'VERIFIED' || input.resolvedInId)) {
    return {
      kind: 'unproven',
      statusLabel: SITE_BOARD_COPY.flagProofMissing,
      body: SITE_BOARD_COPY.flagProofMissingBody,
      nextStep: 'verify',
    }
  }
  return { kind: 'open', statusLabel: SITE_BOARD_COPY.flagStatus }
}

export type ResolvedFlagEntry<T extends { id: string; sourceFlagId?: string | null }> = {
  at: string
  seed: T
  /** Other Flag ids that already represent this recovery, so the list shows it once. */
  occurrenceFlagIds?: string[]
}

/**
 * Newest recovery first, one row per Flag. A verified improvement that points
 * at a Flag already in the list is the same recovery, not a second row.
 */
export function selectResolvedFlags<T extends { id: string; sourceFlagId?: string | null }>(
  entries: Array<ResolvedFlagEntry<T>>,
  limit = 50,
): T[] {
  const sorted = [...entries].sort((left, right) => {
    const byTime = right.at.localeCompare(left.at)
    if (byTime !== 0) return byTime
    return left.seed.id.localeCompare(right.seed.id)
  })
  const seen = new Set<string>()
  const selected: T[] = []
  for (const entry of sorted) {
    const keys = [entry.seed.id, entry.seed.sourceFlagId, ...(entry.occurrenceFlagIds ?? [])].filter(
      (key): key is string => typeof key === 'string' && key.length > 0,
    )
    if (keys.some((key) => seen.has(key))) continue
    for (const key of keys) seen.add(key)
    selected.push(entry.seed)
    if (selected.length >= limit) break
  }
  return selected
}
