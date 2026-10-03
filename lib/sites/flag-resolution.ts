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

function proofNote(input: FlagResolutionInput): FlagProofNote | null {
  const proof = input.proof
  if (!input.resolvedInId || !proof) return null
  if (proof.id !== input.resolvedInId) return null
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
 * Recovered requires a completed proof audit with the same id the Flag recorded.
 * The detail status is often the improvement's PROPOSED or VERIFIED, so the
 * proof is not limited to the flag-row value FIXED. An open, regressed, or
 * ignored Flag stays open even if a proof object is passed in. Anything else
 * that recorded a proof id, without a completed match, is unverified.
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
  if (!stillOpen && (input.status === 'FIXED' || input.resolvedInId)) {
    return {
      kind: 'unproven',
      statusLabel: SITE_BOARD_COPY.flagProofMissing,
      body: SITE_BOARD_COPY.flagProofMissingBody,
      nextStep: 'verify',
    }
  }
  return { kind: 'open', statusLabel: SITE_BOARD_COPY.flagStatus }
}
