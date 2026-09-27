import { prisma } from '@/lib/db'
import { recordFlagImprovementAttempt } from '@/lib/improvements/service'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'

export async function recordSiteFlagFix(input: {
  siteId: string
  flagId: string
  userId: string
  idempotencyKey: string
  changeSummary: string
  commitReference?: string
  deploymentReference?: string
  client?: string
}) {
  const site = await loadSiteRecord(input.siteId)
  if (!site?.projectId || site.userId !== input.userId) throw new Error('Site not found')
  const flag = await loadSiteFlagDetail(site, input.flagId)
  if (!flag) throw new Error('Flag not found')

  const result = await recordFlagImprovementAttempt({
    flagId: flag.sourceFlagId ?? flag.id,
    userId: input.userId,
    builder: 'site',
    client: input.client,
    actor: input.userId,
    action: 'READY_TO_VERIFY',
    changeSummary: input.changeSummary,
    deploymentReference: input.deploymentReference,
  })
  if (!result.attemptId) throw new Error('Could not record this fix attempt')

  return {
    siteId: site.siteId,
    flagId: flag.id,
    attemptId: result.attemptId,
    idempotencyKey: input.idempotencyKey,
    commitReference: input.commitReference ?? null,
    deploymentReference: input.deploymentReference ?? null,
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
