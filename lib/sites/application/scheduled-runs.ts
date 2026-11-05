import { assertAdminDomainActor } from '@/lib/admin/domain-actor'
import { prisma } from '@/lib/db'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { requestSiteRun } from './run-requests'
import { SiteRunRefusal } from './run-refusal'
import { commitScheduledRun, settleIdleScheduledCare } from './scheduled-completion'
import { readExecutionSpec } from '../domain/execution-spec'
import { loadFreshScheduledBroadSource, scheduledOutcomesWhere } from './scheduled-scope'
import { loadRunRequestByKey } from './run-request-keys'

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
  const existing = await loadRunRequestByKey({
    projectId: input.projectId, source: 'WATCH', idempotencyKey: key,
  })
  if (existing) {
    const spec = readExecutionSpec(existing.executionSpec)
    if (existing.environment !== 'production' || existing.verificationTarget != null ||
      !spec || spec.environment !== 'production' || spec.verificationTarget !== null || !['SITE', 'OUTCOMES'].includes(spec.scope)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    assertScheduledExecution(input.projectId, existing)
    return commit({ runId: existing.id, auditId: existing.auditId, outcomeIds: existing.selections.map(item => item.outcomeId).sort(), reused: true })
  }
  const recentSiteCheck = await loadFreshScheduledBroadSource(prisma, { ...input, targetUrl: project.url })
  let scope: 'OUTCOMES' | 'SITE' = recentSiteCheck ? 'OUTCOMES' : 'SITE'
  let outcomes = scope === 'OUTCOMES' ? await prisma.siteOutcome.findMany({
    where: scheduledOutcomesWhere(input.projectId), select: { id: true }, orderBy: { id: 'asc' },
  }) : []
  if (scope === 'OUTCOMES' && !outcomes.length) {
    const selected = await settleIdleScheduledCare({ projectId: input.projectId, userId: input.userId, targetUrl: project.url,
      interval: input.interval, everyMinutes: input.everyMinutes, admittedAt: input.now, operator: input.operator,
      ...(input.claim ? { claim: { ...input.claim, targetUrl: project.url, interval: input.interval,
        everyMinutes: input.everyMinutes ?? null, scheduledAt: input.scheduledAt } } : {}),
    })
    if (selected.scope === 'NONE') return { runId: null, auditId: null, outcomeIds: [], reused: true, retainedAuditId: selected.retainedAuditId }
    scope = selected.scope
    outcomes = selected.outcomes
  }
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
