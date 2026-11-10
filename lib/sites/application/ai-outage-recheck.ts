import { prisma } from '@/lib/db'
import type { TriageFailureReason } from '@/lib/audit/pipeline/triage-failure'

/** Provider failures that leave a check partial through no fault of the Site. */
const AI_OUTAGE_REASONS: ReadonlySet<TriageFailureReason> = new Set(['provider_exhausted', 'provider_rejected', 'budget_unavailable'])
const AI_OUTAGE_CODES = ['AI_PROVIDER_UNAVAILABLE', 'AI_PROVIDER_REJECTED', 'AI_BUDGET_UNAVAILABLE']
export const AI_OUTAGE_RECHECK_MS = 60 * 60_000

/**
 * A check the AI provider left partial is checked again once, about an hour
 * later, through the Site's own monitoring schedule. A second consecutive
 * outage keeps the normal cadence, so a long outage cannot loop full checks.
 * Paused, removed and unmonitored Sites are left alone.
 */
export async function scheduleAiOutageRecheck(auditId: string, reason: TriageFailureReason, now = new Date()): Promise<boolean> {
  if (!AI_OUTAGE_REASONS.has(reason)) return false
  const audit = await prisma.audit.findUnique({ where: { id: auditId }, select: { projectId: true, createdAt: true } })
  if (!audit?.projectId) return false
  const previous = await prisma.audit.findFirst({
    where: { projectId: audit.projectId, id: { not: auditId }, status: 'COMPLETED', createdAt: { lt: audit.createdAt } },
    orderBy: { createdAt: 'desc' }, select: { failureCode: true },
  })
  if (previous?.failureCode && AI_OUTAGE_CODES.includes(previous.failureCode)) return false
  const retryAt = new Date(now.getTime() + AI_OUTAGE_RECHECK_MS)
  const moved = await prisma.project.updateMany({
    where: { id: audit.projectId, deletedAt: null, watchPausedAt: null, watchInterval: { not: null }, watchNextRunAt: { gt: retryAt } },
    data: { watchNextRunAt: retryAt },
  })
  return moved.count === 1
}
