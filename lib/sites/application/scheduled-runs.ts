import { assertAdminDomainActor } from '@/lib/admin/domain-actor'
import { prisma } from '@/lib/db'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { siteCareIntervalMinutes } from '../evidence-freshness'
import { analysisEnvironmentWhere, siteWideAnalysisAuditWhere } from './analysis-scope'
import { requestSiteRun } from './run-requests'
import { SiteRunRefusal } from './run-refusal'
import { commitScheduledRun } from './scheduled-completion'
import { interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'
import { readExecutionSpec } from '../domain/execution-spec'

/** Reusing an admission does not make a failed or missing execution viable. */
function assertScheduledExecution(projectId: string, receipt: { status: string; audit: { projectId: string | null; status: string } | null } | null) {
  if (!receipt || receipt.status === 'FAILED' || !receipt.audit || receipt.audit.projectId !== projectId || receipt.audit.status === 'FAILED')
    throw new SiteRunRefusal('The scheduled check did not finish. FixFlags will try again.', 409, 'SCHEDULED_RUN_UNAVAILABLE')
}

/** One scheduled intent retains its admitted scope across interruptions. Fresh
 * broad observations avoid duplicate collection; bindings retain their cadence. */
export async function requestScheduledSiteRun(input: {
  projectId: string; userId: string; interval: WatchInterval; everyMinutes?: number | null;
  scheduledAt: Date; now: Date; operator?: import('@/lib/admin/domain-actor').AdminDomainActor;
  claim?: { attemptedAt: Date; leaseUntil: Date };
}) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: input.userId, deletedAt: null }, select: { url: true } })
  if (!project) throw new SiteRunRefusal('Site not found', 404)
  if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId)
  const commit = async <T extends { runId: string }>(started: T): Promise<T> => {
    if (input.claim) await commitScheduledRun({ projectId: input.projectId, userId: input.userId, runId: started.runId,
      admittedAt: input.now, operator: input.operator, claim: { ...input.claim, targetUrl: project.url, interval: input.interval,
        everyMinutes: input.everyMinutes ?? null, scheduledAt: input.scheduledAt } })
    return started
  }
  const key = `watch:${input.projectId}:${input.scheduledAt.toISOString()}:${input.interval}:${input.everyMinutes ?? ''}`
  const existing = await prisma.runRequest.findUnique({ where: { projectId_source_idempotencyKey: {
    projectId: input.projectId, source: 'WATCH', idempotencyKey: key,
  } }, include: { selections: { select: { outcomeId: true } }, audit: { select: { projectId: true, status: true } } } })
  if (existing) {
    const spec = readExecutionSpec(existing.executionSpec)
    if (existing.environment !== 'production' || existing.verificationTarget != null ||
      !spec || spec.environment !== 'production' || spec.verificationTarget !== null || !['SITE', 'OUTCOMES'].includes(spec.scope)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    assertScheduledExecution(input.projectId, existing)
    return commit({ runId: existing.id, auditId: existing.auditId, outcomeIds: existing.selections.map(item => item.outcomeId).sort(), reused: true })
  }
  const target = normalizeAuditNavigationUrl(project.url)
  const recentSiteCheck = await prisma.audit.findFirst({ where: { projectId: input.projectId,
    status: 'COMPLETED', url: target.ok ? target.url : project.url, ...siteWideAnalysisAuditWhere,
    AND: [analysisEnvironmentWhere('production')],
    // One scheduler tick of tolerance avoids doubling daily/weekly periods
    // merely because admission committed just after the preceding tick.
    createdAt: { gt: new Date(input.now.getTime() - siteCareIntervalMinutes(input.interval, input.everyMinutes) * 60_000 + 60_000) },
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true,
    verifierExecutions: { where: interruptedAnalysisWorkWhere, select: { id: true }, take: 1 } } })
  const scope = recentSiteCheck && !recentSiteCheck.verifierExecutions.length ? 'OUTCOMES' : 'SITE'
  const outcomes = scope === 'OUTCOMES' ? await prisma.siteOutcome.findMany({
    where: { projectId: input.projectId, enabled: true, environment: 'production',
      bindings: { some: { enabled: true, required: true } } }, select: { id: true }, orderBy: { id: 'asc' },
  }) : []
  const started = await requestSiteRun({ projectId: input.projectId, userId: input.userId, source: 'WATCH', scope, operator:input.operator,
    ...(input.claim ? { scheduledClaim: { ...input.claim, targetUrl: project.url, interval: input.interval,
      everyMinutes: input.everyMinutes ?? null, scheduledAt: input.scheduledAt } } : {}),
    outcomeIds: outcomes.map(outcome => outcome.id), idempotencyKey: key,
    context: { ...(input.operator?{adminOperationId:input.operator.operationId}:{}), cadence: input.interval, ...(input.interval === 'custom' ? { everyMinutes: input.everyMinutes } : {}) },
  })
  if (started.reused) assertScheduledExecution(input.projectId, await prisma.runRequest.findUnique({
    where: { id: started.runId, projectId: input.projectId },
    select: { status: true, audit: { select: { projectId: true, status: true } } },
  }))
  return commit(started)
}
