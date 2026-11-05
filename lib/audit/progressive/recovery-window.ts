import type { Audit, Prisma } from '@prisma/client'
import { ANALYSIS_RECOVERY_MS } from './contracts'

/** A stored admission deadline stays authoritative across queue delays and
 * restarts. Historical work without one retains the original bounded fallback. */
export function analysisRecoveryEndsAt(audit: Pick<Audit, 'createdAt' | 'recoveryUntil'>): number {
  return audit.recoveryUntil?.getTime() ?? audit.createdAt.getTime() + ANALYSIS_RECOVERY_MS
}

export function expiredAnalysisRecoveryWhere(now: Date): Prisma.AuditWhereInput {
  return { OR: [
    { recoveryUntil: { lte: now } },
    { recoveryUntil: null, createdAt: { lte: new Date(now.getTime() - ANALYSIS_RECOVERY_MS) } },
  ] }
}
