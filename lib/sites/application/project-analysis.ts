import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { syncOutcomesFromAudit } from '@/lib/sites/outcomes'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'

/** Runs before the durable finalization receipt; failure is retried by finalization recovery. */
export async function projectSiteAnalysis(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUniqueOrThrow({
    where: { id: auditId },
    select: { projectId: true, userId: true, url: true, executionSpec: true },
  })
  const scope = readExecutionSpec(audit.executionSpec)?.scope
  if (scope && scope !== 'SITE') return
  const provisional = audit.projectId ? null : await prisma.provisionalSite.findFirst({
    where: { primaryAuditId: auditId },
    select: { id: true, sessionKey: true },
  })
  if (!scope && !provisional) {
    const recorded = await prisma.provisionalSite.findFirst({ where: { primaryAuditId: auditId, claimedProjectId: audit.projectId }, select: { id: true } })
    if (!recorded) return
  }
  // Historical analyses without a customer Site have no Site projection to maintain.
  if (!audit.projectId && !provisional) return
  // This analysis has no project. Keep it on the provisional that recorded it,
  // including after that provisional is claimed. Following the claim would
  // target the owner's project, which does not own the analysis.
  const site = await loadSiteRecord(
    audit.projectId ?? `p_${provisional!.id}`,
    provisional ? { viewer: { sessionKey: provisional.sessionKey } } : undefined,
  )
  if (!site) throw new Error('Site disappeared during analysis projection')
  await syncOutcomesFromAudit({ site, auditId, url: audit.url })
  await recordSiteLifecycleEvent({
    name: 'analysis_completed',
    idempotencyKey: `analysis_completed:${auditId}`,
    userId: audit.userId,
    projectId: audit.projectId,
    properties: { provisional: !audit.projectId, usefulnessAssessed: false },
  }).catch(() => undefined)
}
