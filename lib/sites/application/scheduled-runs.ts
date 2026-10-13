import { prisma } from '@/lib/db'
import { normalizeAuditUrl } from '@/lib/audit/url'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { siteCareIntervalMinutes } from './care-policy'
import { siteWideAnalysisAuditWhere } from './analysis-scope'
import { requestSiteRun } from './run-requests'
import { SiteRunRefusal } from './run-refusal'
import { readExecutionSpec } from '../domain/execution-spec'

/** One scheduled intent retains its admitted scope across interruptions. Fresh
 * broad observations avoid duplicate collection; bindings retain their cadence. */
export async function requestScheduledSiteRun(input: {
  projectId: string; userId: string; interval: WatchInterval; everyMinutes?: number | null;
  scheduledAt: Date; now: Date; operator?: import('@/lib/admin/domain-actor').AdminDomainActor;
}) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: input.userId, deletedAt: null }, select: { url: true } })
  if (!project) throw new SiteRunRefusal('Site not found', 404)
  const key = `watch:${input.projectId}:${input.scheduledAt.toISOString()}:${input.interval}:${input.everyMinutes ?? ''}`
  const existing = await prisma.runRequest.findUnique({ where: { projectId_source_idempotencyKey: {
    projectId: input.projectId, source: 'WATCH', idempotencyKey: key,
  } }, include: { selections: { select: { outcomeId: true } } } })
  if (existing) {
    const spec = readExecutionSpec(existing.executionSpec)
    if (existing.environment !== 'production' || existing.verificationTarget != null ||
      !spec || spec.environment !== 'production' || spec.verificationTarget !== null || !['SITE', 'OUTCOMES'].includes(spec.scope)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    return { runId: existing.id, auditId: existing.auditId, outcomeIds: existing.selections.map(item => item.outcomeId).sort(), reused: true }
  }
  const target = normalizeAuditUrl(project.url)
  const recentSiteCheck = await prisma.audit.findFirst({ where: { projectId: input.projectId,
    status: 'COMPLETED', url: target.ok ? target.url : project.url, ...siteWideAnalysisAuditWhere,
    executionSpec: { path: ['environment'], equals: 'production' },
    // One scheduler tick of tolerance avoids doubling daily/weekly periods
    // merely because admission committed just after the preceding tick.
    createdAt: { gt: new Date(input.now.getTime() - siteCareIntervalMinutes(input.interval, input.everyMinutes) * 60_000 + 60_000) },
  }, select: { id: true } })
  const scope = recentSiteCheck ? 'OUTCOMES' : 'SITE'
  const outcomes = scope === 'OUTCOMES' ? await prisma.siteOutcome.findMany({
    where: { projectId: input.projectId, enabled: true, environment: 'production',
      bindings: { some: { enabled: true, required: true } } }, select: { id: true }, orderBy: { id: 'asc' },
  }) : []
  return requestSiteRun({ projectId: input.projectId, userId: input.userId, source: 'WATCH', scope, operator:input.operator,
    outcomeIds: outcomes.map(outcome => outcome.id), idempotencyKey: key,
    context: { ...(input.operator?{adminOperationId:input.operator.operationId}:{}), cadence: input.interval, ...(input.interval === 'custom' ? { everyMinutes: input.everyMinutes } : {}) },
  })
}
