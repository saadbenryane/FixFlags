import { prisma } from '@/lib/db'
import { recordOwnerFlagFeedbackDecision } from '@/lib/improvements/service'
import { normalizeImprovementRejectionReason } from '@/lib/improvements/rejection-reasons'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { logger } from '@/lib/logger'

export type RecordFlagFeedbackInput = {
  flagId: string
  visitorToken: string
  userId: string | null
  vote: number
  comment?: string
  reason?: string
  dismiss?: boolean
}

/**
 * Persist public feedback and, only for the owning user, apply the corresponding
 * Product judgment. The route never needs database ownership knowledge.
 */
export async function recordFlagFeedback(input: RecordFlagFeedbackInput) {
  const flag = await prisma.flag.findUnique({
    where: { id: input.flagId },
    select: {
      id: true,
      audit: { select: { userId: true, projectId: true } },
    },
  })
  if (!flag) return null

  const reasonLabel = input.reason
    ? input.reason.toLowerCase().replace(/_/g, ' ')
    : null
  const rejectionReason = normalizeImprovementRejectionReason(input.reason)
  const commentParts = [
    reasonLabel ? `Dismiss reason: ${reasonLabel}` : null,
    input.comment?.trim() || null,
  ].filter(Boolean)
  const comment = commentParts.length > 0 ? commentParts.join('. ') : null

  const feedback = await prisma.flagFeedback.upsert({
    where: {
      flagId_visitorToken: {
        flagId: input.flagId,
        visitorToken: input.visitorToken,
      },
    },
    create: {
      flagId: input.flagId,
      visitorToken: input.visitorToken,
      userId: input.userId,
      vote: input.vote,
      comment,
      reason: rejectionReason,
    },
    update: {
      vote: input.vote,
      comment,
      userId: input.userId,
      reason: rejectionReason,
    },
  })

  if (input.userId && flag.audit.userId === input.userId) {
    await recordSiteLifecycleEvent({ name: 'flag_feedback_recorded',
      idempotencyKey: `flag-feedback:${feedback.id}:${input.vote}:${rejectionReason ?? 'none'}`,
      userId: input.userId, projectId: flag.audit.projectId,
      properties: { vote: input.vote, reason: rejectionReason, owner: true },
    }).catch(error => logger.warn('Flag feedback telemetry could not be recorded', { error: error instanceof Error ? error.message : 'unknown' }))
  }

  if (
    input.dismiss &&
    input.reason &&
    input.userId &&
    flag.audit.userId === input.userId
  ) {
    await recordOwnerFlagFeedbackDecision({
      flagId: input.flagId,
      userId: input.userId,
      reason: input.reason,
      note: input.comment,
    })
  }

  return feedback
}
