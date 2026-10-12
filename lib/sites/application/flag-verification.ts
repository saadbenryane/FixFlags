import { prisma } from '@/lib/db'
import { recordFlagImprovementAttempt } from '@/lib/improvements/service'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { ImprovementAttemptConflict } from '@/lib/improvements/attempt-intent'

export async function recordSiteFlagFix(input: {
  siteId: string
  flagId: string
  userId: string
  idempotencyKey?: string
  changeSummary?: string
  commitReference?: string
  deploymentReference?: string
  client?: string
}) {
  const site = await loadSiteRecord(input.siteId)
  if (!site?.projectId || site.userId !== input.userId) throw new Error('Site not found')
  const flag = await loadSiteFlagDetail(site, input.flagId)
  if (!flag) throw new Error('Flag not found')

  const key = input.idempotencyKey?.trim()
  const recorded = key && flag.improvementId ? await prisma.improvementAttempt.findFirst({
    where: { improvementId: flag.improvementId, idempotencyKey: key,
      improvement: { projectId: site.projectId, project: { userId: input.userId } } },
  }) : null
  const sourceFlagId = flag.sourceFlagId ?? flag.id
  if (recorded && input.flagId !== flag.improvementId && recorded.handoffReference !== 'flag:' + sourceFlagId) throw new ImprovementAttemptConflict()
  // A durable Improvement may point to a later occurrence by the time a retry
  // arrives. Replay its original source; ownership is rechecked by the service.
  const recordedSource = recorded?.handoffReference?.startsWith('flag:') ? recorded.handoffReference.slice(5) : null
  const result = await recordFlagImprovementAttempt({
    flagId: recordedSource ?? sourceFlagId,
    userId: input.userId,
    builder: 'site',
    client: input.client,
    actor: input.userId,
    action: 'READY_TO_VERIFY',
    changeSummary: input.changeSummary,
    deploymentReference: input.deploymentReference,
    commitReference: input.commitReference,
    idempotencyKey: key,
  })
  if (!result.attemptId) throw new Error('Could not record this fix attempt')

  return {
    siteId: site.siteId,
    flagId: flag.id,
    attemptId: result.attemptId,
    idempotencyKey: key,
    changeSummary: 'changeSummary' in result ? result.changeSummary : null,
    commitReference: 'commitReference' in result ? result.commitReference : null,
    deploymentReference: 'deploymentReference' in result ? result.deploymentReference : null,
    sourceAuditId: result.sourceReviewId,
    verificationAuditId: 'verificationAuditId' in result ? result.verificationAuditId : null,
    outcome: 'outcome' in result ? result.outcome : null,
  }
}

export async function requireSiteFlagAttempt(input: {
  siteId: string
  flagId: string
  attemptId: string
  userId: string
}) {
  const site = await loadSiteRecord(input.siteId)
  if (!site?.projectId || site.userId !== input.userId) throw new Error('Site not found')
  const flag = await loadSiteFlagDetail(site, input.flagId)
  if (!flag?.improvementId) throw new Error('Record the fix before verification')
  const attempt = await prisma.improvementAttempt.findFirst({
    where: {
      id: input.attemptId,
      improvementId: flag.improvementId,
      sourceAuditId: flag.sourceAuditId,
      outcome: null,
      improvement: { projectId: site.projectId, project: { userId: input.userId } },
    },
    select: { id: true },
  })
  if (!attempt) throw new Error('Fix attempt not found or already verified')
  return { site, flag, attemptId: attempt.id }
}
