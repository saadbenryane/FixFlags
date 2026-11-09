import { assertAdminDomainActor } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { prisma } from '@/lib/db'
import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { requestSiteRun } from './run-requests'
import { SiteRunRefusal } from './run-refusal'
import { commitScheduledRun, settleIdleScheduledCare } from './scheduled-completion'
import { readExecutionSpec } from '../domain/execution-spec'
import { loadFreshScheduledBroadSource, scheduledOutcomesWhere } from './scheduled-scope'
import { loadRunRequestByKey } from './run-request-keys'
import { watchRunTargetsSite, watchTargetHash } from './scheduled-observation'
import { staleScheduledClaim } from './scheduled-admission'
import { WATCH_MESSAGES } from '../watch-state'

export class ScheduledRunCommitDeferred extends Error {
  constructor(readonly runId: string, cause: unknown) {
    super('The admitted monitoring run still needs its schedule recorded.', { cause })
    this.name = 'ScheduledRunCommitDeferred'
  }
}

/** Reusing an admission does not make a failed or missing execution viable. */
function assertScheduledExecution(projectId: string, receipt: { status: string; audit: { projectId: string | null; status: string } | null } | null) {
  if (!receipt || receipt.status === 'FAILED' || !receipt.audit || receipt.audit.projectId !== projectId || receipt.audit.status === 'FAILED')
    throw new SiteRunRefusal(WATCH_MESSAGES.retryPending, 409, 'SCHEDULED_RUN_UNAVAILABLE')
}

/** One scheduled intent retains its admitted scope across interruptions. Fresh
 * broad observations avoid duplicate collection; bindings retain their cadence. */
export async function requestScheduledSiteRun(input: {
  projectId: string; userId: string; interval: WatchInterval; everyMinutes?: number | null;
  scheduledAt: Date; now: Date; operator?: import('@/lib/admin/domain-actor').AdminDomainActor;
  claim?: { attemptedAt: Date; leaseUntil: Date; targetRevision?: number; targetUrl?: string };
}) {
  const project = await prisma.project.findFirst({ where: { id: input.projectId, userId: input.userId, deletedAt: null }, select: { url: true, watchTargetRevision: true } })
  if (!project) throw new SiteRunRefusal('Site not found', 404)
  if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId)
  const revision = project.watchTargetRevision ?? 1
  if (input.claim && (input.claim.targetRevision !== undefined && input.claim.targetRevision !== revision ||
    input.claim.targetUrl !== undefined && input.claim.targetUrl !== project.url)) throw staleScheduledClaim()
  const claim = input.claim && { ...input.claim, targetUrl: project.url, ...(revision > 1 ? { targetRevision: revision } : {}), interval: input.interval,
    everyMinutes: input.everyMinutes ?? null, scheduledAt: input.scheduledAt }
  const commit = async <T extends { runId: string }>(started: T): Promise<T> => {
    if (!claim) return started
    try {
      await commitScheduledRun({ projectId: input.projectId, userId: input.userId, runId: started.runId,
        admittedAt: input.now, operator: input.operator, claim })
    } catch (error) {
      if (error instanceof SiteRunRefusal || error instanceof AdminActionError) throw error
      throw new ScheduledRunCommitDeferred(started.runId, error)
    }
    return started
  }
  const legacyKey = `watch:${input.projectId}:${input.scheduledAt.toISOString()}:${input.interval}:${input.everyMinutes ?? ''}`
  const targetKey = `${legacyKey}:target:${revision}:${watchTargetHash(project.url)}`
  const read = (key: string) => loadRunRequestByKey({ projectId: input.projectId, source: 'WATCH', idempotencyKey: key })
  let key = revision === 1 ? legacyKey : targetKey
  let existing = await read(key)
  const legacySpec = readExecutionSpec(existing?.executionSpec)
  if (key === legacyKey && existing?.environment === 'production' && existing.verificationTarget == null &&
    legacySpec?.environment === 'production' && legacySpec.verificationTarget === null &&
    ['SITE', 'OUTCOMES'].includes(legacySpec.scope) && !watchRunTargetsSite(legacySpec.targetUrl, existing.context, project)) {
    key = targetKey
    existing = await read(key)
  }
  if (existing) {
    const spec = readExecutionSpec(existing.executionSpec)
    if (existing.environment !== 'production' || existing.verificationTarget != null ||
      !spec || spec.environment !== 'production' || spec.verificationTarget !== null || !['SITE', 'OUTCOMES'].includes(spec.scope)) throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    if (!watchRunTargetsSite(spec.targetUrl, existing.context, project)) throw staleScheduledClaim()
    assertScheduledExecution(input.projectId, existing)
    return commit({ runId: existing.id, auditId: existing.auditId, outcomeIds: existing.selections.map(item => item.outcomeId).sort(), reused: true })
  }
  const recentSiteCheck = await loadFreshScheduledBroadSource(prisma, { ...input, targetUrl: project.url, targetRevision: revision })
  let scope: 'OUTCOMES' | 'SITE' = recentSiteCheck ? 'OUTCOMES' : 'SITE'
  let outcomes = scope === 'OUTCOMES' ? await prisma.siteOutcome.findMany({
    where: scheduledOutcomesWhere(input.projectId), select: { id: true }, orderBy: { id: 'asc' },
  }) : []
  if (scope === 'OUTCOMES' && !outcomes.length) {
    const selected = await settleIdleScheduledCare({ projectId: input.projectId, userId: input.userId, targetUrl: project.url,
      interval: input.interval, everyMinutes: input.everyMinutes, admittedAt: input.now, operator: input.operator,
      ...(claim ? { claim } : {}),
    })
    if (selected.scope === 'NONE') return { runId: null, auditId: null, outcomeIds: [], reused: true, retainedAuditId: selected.retainedAuditId }
    scope = selected.scope
    outcomes = selected.outcomes
  }
  const admission = { projectId: input.projectId, userId: input.userId, source: 'WATCH' as const, scope, operator:input.operator,
    ...(claim ? { scheduledClaim: claim } : {}),
    outcomeIds: outcomes.map(outcome => outcome.id), idempotencyKey: key,
    context: { ...(input.operator?{adminOperationId:input.operator.operationId}:{}), cadence: input.interval, ...(input.interval === 'custom' ? { everyMinutes: input.everyMinutes } : {}) },
  }
  const started = await requestSiteRun(admission).catch(error => {
    if (scope !== 'OUTCOMES' || !claim || !(error instanceof SiteRunRefusal) || error.code !== 'SITE_RUN_IN_PROGRESS') throw error
    // Current broad work can satisfy this tick even while older broad evidence
    // is fresh. A race that releases the active Run cannot start a new scan.
    return requestSiteRun({ ...admission, scope: 'SITE', outcomeIds: [] }, { reuseOnly: true })
  })
  // Scheduled commits validate the saved execution under the Site lock.
  if (started.reused && !claim) assertScheduledExecution(input.projectId, await prisma.runRequest.findUnique({
    where: { id: started.runId, projectId: input.projectId },
    select: { status: true, audit: { select: { projectId: true, status: true } } },
  }))
  return commit(started)
}
