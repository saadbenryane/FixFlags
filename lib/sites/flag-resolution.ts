import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { attemptHasActiveVerification, attemptTargetsFlag } from '@/lib/improvements/attempt-state'
import { verificationResult } from './presentation'

export const FLAG_VERIFICATION_FEEDBACK_RESULTS = ['still_open', 'regressed', 'could_not_verify', 'missing_evidence', 'incomparable_scope'] as const
export type FlagVerificationFeedback = { result: typeof FLAG_VERIFICATION_FEEDBACK_RESULTS[number]; checkedAt: string | null }

/** Current unsuccessful verification belongs to the captured source. Recovery
 * remains owned by the Flag's independently established resolution proof. */
export function flagVerificationFeedback(input: {
  projectId: string | null; sourceAuditId: string; sourceFlagId: string; observedAt?: Date;
  attempts: Array<{ outcome: string | null; comparable: boolean | null; verificationReason: string | null;
    sourceAuditId: string; sourceFlagIds?: readonly string[]; handoffReference?: string | null; verificationAuditId: string | null;
    verificationAudit?: { id: string; projectId: string | null; parentId: string | null; status: string; createdAt?: Date | null; completedAt?: Date | null;
      verifierExecutions?: Array<{ workKind?: string | null; workState?: string | null }> } | null }>
}): FlagVerificationFeedback | null {
  if (!input.projectId) return null
  const matching = input.attempts.filter(item => {
    const audit = item.verificationAudit
    if (!audit || audit.id !== item.verificationAuditId || audit.projectId !== input.projectId || audit.parentId !== item.sourceAuditId) return false
    return attemptTargetsFlag(item, input.sourceAuditId, input.sourceFlagId)
  })
  // Tasks may be copied long before their checks are admitted. Prefer actual
  // check order, retaining the supplied newest-task order for legacy records.
  const attempt = matching.reduce<typeof matching[number] | undefined>((latest, item) => {
    const nextAt = item.verificationAudit?.createdAt?.getTime() ?? Number.NaN
    const latestAt = latest?.verificationAudit?.createdAt?.getTime() ?? Number.NaN
    return !latest || nextAt > latestAt ? item : latest
  }, undefined)
  const audit = attempt?.verificationAudit
  if (!attempt || !audit || !['COMPLETED', 'FAILED'].includes(audit.status) ||
    attemptHasActiveVerification(attempt, input.projectId, input.sourceAuditId, input.sourceFlagId)) return null
  const checkedAt = audit.completedAt && Number.isFinite(audit.completedAt.getTime()) ? audit.completedAt : null
  if (checkedAt && input.observedAt && checkedAt < input.observedAt) return null
  const result = verificationResult({ outcome: audit.status === 'FAILED' ? null : attempt.outcome,
    comparable: attempt.comparable, reason: attempt.verificationReason, verificationAuditId: attempt.verificationAuditId })
  if (result === 'unverified' || result === 'verifying' || result === 'verified') return null
  return { result, checkedAt: checkedAt?.toISOString() ?? null }
}

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
  observedAt: string | null
  auditId: string
  showAuditId: boolean
  observation: string
}

export type FlagResolution =
  | { kind: 'open'; statusLabel: string }
  | { kind: 'verifying'; statusLabel: string; proof: FlagProofNote | null; runningNote: string }
  | { kind: 'proven'; statusLabel: string; proof: FlagProofNote }
  | { kind: 'unproven'; statusLabel: string; body: string; nextStep: 'verify' }

/** Recovery and recurrence belong to the observed incident. Repair workflow
 * remains separate and cannot reopen a fixed observation. */
export function siteFlagDetailStatus(
  improvementStatus: string | null | undefined,
  flagStatus: string,
  verifiedForSource = false,
): string {
  if (['FIXED', 'REGRESSED', 'IGNORED'].includes(flagStatus)) return flagStatus
  if (verifiedForSource) return 'VERIFIED'
  if (improvementStatus === 'VERIFIED') return flagStatus
  return improvementStatus ?? flagStatus
}

/** Project current incident attention without rewriting repair declarations.
 * A fixed row without its completed, tenant-owned recovery remains unverified. */
export function currentIncidentFlags<T extends { status: string; resolvedInId?: string | null }>(
  flags: T[], completedRecoveryIds: IncidentRecoveryProofIndex,
): Array<Omit<T, 'status'> & { status: string }>
export function currentIncidentFlags<T extends { status?: string | null; resolvedInId?: string | null }>(
  flags: T[], completedRecoveryIds: IncidentRecoveryProofIndex,
): Array<Omit<T, 'status'> & { status?: string | null }>
export function currentIncidentFlags<T extends { status?: string | null; resolvedInId?: string | null }>(
  flags: T[], completedRecoveryIds: IncidentRecoveryProofIndex,
): Array<Omit<T, 'status'> & { status?: string | null }> {
  return flags.flatMap(flag => {
    if (flag.status === 'IGNORED') return []
    if (flag.status !== 'FIXED') return [flag]
    if (hasIncidentRecoveryProof(flag, completedRecoveryIds)) return []
    return [{ ...flag, status: 'UNVERIFIED' }]
  })
}

export type IncidentRecoveryProofIndex = {
  has(id: string): boolean
  hasFlag?: (flag: { id?: string; resolvedInId?: string | null }) => boolean
}

/** The application index proves each original condition independently. */
export function hasIncidentRecoveryProof(flag: { id?: string; resolvedInId?: string | null }, proofs: IncidentRecoveryProofIndex): boolean {
  if (!flag.resolvedInId) return false
  return proofs.hasFlag ? proofs.hasFlag(flag) : proofs.has(flag.resolvedInId)
}

export function currentUnboundFindings<T extends { id: string; fingerprint?: string | null; status: string; resolvedInId?: string | null }>(
  flags: T[], proofs: IncidentRecoveryProofIndex,
) {
  const seen = new Set<string>()
  return currentIncidentFlags(flags, proofs).filter(flag => {
    const identity = flag.fingerprint ? `fingerprint:${flag.fingerprint}` : `flag:${flag.id}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

/** An unbound legacy finding must not replace a newer recorded occurrence.
 * Missing timestamps cannot establish that a candidate is newer. */
export function newestRecordedFlag<T extends { id: string; createdAt?: Date }>(flags: T[]): T | undefined {
  return flags.reduce<T | undefined>((current, candidate) => {
    if (!current) return candidate
    if (!current.createdAt || !candidate.createdAt) return current
    const difference = candidate.createdAt.getTime() - current.createdAt.getTime()
    return difference > 0 || difference === 0 && candidate.id.localeCompare(current.id) > 0 ? candidate : current
  }, undefined)
}

export function incidentAffectedPaths(flags: Array<{ pageUrl?: string | null; affectedPaths?: unknown }>): string[] {
  return [...new Set(flags.flatMap(flag => Array.isArray(flag.affectedPaths) && flag.affectedPaths.some(path => typeof path === 'string' && path.length > 0)
    ? flag.affectedPaths.filter((path): path is string => typeof path === 'string' && path.length > 0) : flag.pageUrl ? [flag.pageUrl] : []))]
}

const STILL_OPEN = new Set(['OPEN', 'REGRESSED', 'IGNORED'])

/**
 * The audit id a recovery may cite. Pass attempts newest first, matching
 * loadSiteFlagDetail. The Flag's own resolvedInId wins. When that is absent,
 * a VERIFIED improvement may cite the newest comparable IMPROVED attempt.
 * An unverified loaded status cites nothing. The completed audit was already
 * rejected, and showing it would disagree with the inbox.
 */
export function flagRecoveryProofId(input: {
  status: string
  resolvedInId: string | null
  sourceAuditId?: string | null
  sourceFlagId?: string | null
  attempts: Array<{ outcome: string | null; comparable: boolean | null; verificationAuditId: string | null;
    sourceAuditId?: string; handoffReference?: string | null }>
}): string | null {
  if (input.status === 'UNVERIFIED') return null
  if (input.resolvedInId) return input.resolvedInId
  if (input.status !== 'VERIFIED') return null
  const improved = input.attempts.find(
    (attempt) =>
      attempt.outcome === 'IMPROVED' &&
      attempt.comparable === true &&
      Boolean(input.sourceAuditId && attempt.sourceAuditId === input.sourceAuditId) &&
      (!attempt.handoffReference?.startsWith('flag:') || attempt.handoffReference === 'flag:' + input.sourceFlagId) &&
      typeof attempt.verificationAuditId === 'string' &&
      attempt.verificationAuditId.length > 0,
  )
  return improved?.verificationAuditId ?? null
}

function proofNote(input: FlagResolutionInput): FlagProofNote | null {
  if (input.status === 'UNVERIFIED') return null
  const proof = input.proof
  const proofId = input.resolvedInId ?? (input.status === 'VERIFIED' ? input.attemptProofId ?? null : null)
  if (!proofId || !proof) return null
  if (proof.id !== proofId) return null
  if (proof.status !== 'COMPLETED') return null
  // Creation anchors a retained legacy report, never its missing check time.
  const raw = proof.completedAt ?? proof.createdAt
  if (!raw) return null
  const observed = new Date(raw)
  if (Number.isNaN(observed.getTime())) return null
  return {
    observedAt: proof.completedAt ? observed.toISOString() : null,
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
 * or ignored Flag stays open even if a proof object is passed in. An unverified
 * loaded status stays unverified even when that completed audit is supplied.
 * A recorded proof id, or a VERIFIED status, without a completed match, is unverified.
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
