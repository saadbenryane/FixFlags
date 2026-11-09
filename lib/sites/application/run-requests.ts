import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { createAndEnqueueAudit,RunAdmissionReplay } from '@/lib/audit/create-audit'
import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'
import { prisma } from '@/lib/db'
import { buildAttribution } from '@/lib/leads/attribution'
import { logger } from '@/lib/logger'
import { requireExecutionReady } from '@/lib/queue/execution-readiness'
import { RateLimitError } from '@/lib/security/rate-limit'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { Prisma,type RunRequestSource } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { canonicalIntent,readExecutionSpec,readVerificationTarget,type ExecutionSpec } from '../domain/execution-spec'
import { analysisEnvironmentValueSql,analysisEnvironmentWhere,siteAnalysisAuditWhere,siteWideAnalysisAuditWhere } from './analysis-scope'
import { canonicalExecutionOutcomes,executionIntentHash,monitoringExecutionCovers } from './execution-spec'
import { activeRunWhere,reclaimExpiredRuns,RUN_LEASE_MS } from './run-leases'
import { reconcileOutcomeRunsForAudit } from './run-reconciliation'
import { resolveRunExecution,validateRunSelection } from './run-selection'
import { requireActiveAccount } from '@/lib/auth/account-availability'
import { assertAdminDomainActor, type AdminSiteOperationScope } from '@/lib/admin/domain-actor'
import { loadOwnedRunRequestByKey, loadRunRequestByKey, retainSharedRunKey } from './run-request-keys'
export { getOwnedRun } from './run-queries'
export { markOutcomeRunsCouldNotVerify,reconcileOutcomeRunsForAudit } from './run-reconciliation'

const INTERACTIVE_RUN_LIMIT_PER_DAY = 24

export type { RunInput,SiteRunVerificationTarget } from './run-intent'
export { OUTCOME_RUN_LEASE_MS } from './run-leases'

export function reclaimExpiredOutcomeRuns(projectId: string, authority?: AdminSiteOperationScope): Promise<number> {
  return reclaimExpiredRuns(projectId, reconcileOutcomeRunsForAudit, authority)
}

function auditSource(source: RunRequestSource) {
  if (source === 'MCP') return 'MCP' as const
  if (source === 'API' || source === 'DEPLOYMENT' || source === 'INTEGRATION') return 'API' as const
  return 'DASHBOARD' as const
}

import { safeContext,sameExecutionScope,sameSelection,sameRecordedRunCommand,type RunInput,type SiteRunVerificationTarget } from './run-intent'
import { recordedWatchTargetRevision } from './scheduled-observation'
import { admittedOutcomeAuthorization } from '../domain/outcome-authorization'
/**
 * Which Site runs count against the plan's scan allowance.
 *
 * Only a Site-wide re-scan that a person or an agent asked for is a scan. Two
 * things are deliberately excluded, and both exclusions are load-bearing:
 *
 * - **Scheduled Watch.** `siteCarePolicy` states that review-credit counters
 *   never decide whether Watch is available, and every pricing surface promises
 *   Free "verified weekly". Metering the schedule would make the promise a lie on
 *   the plan that can least afford it.
 * - **Outcome and diagnostic verification.** A Verify run exists to resolve one
 *   named Outcome after a fix. Charging for it would tax the exact loop the
 *   product is built to produce, and would leave someone who shipped a fix unable
 *   to prove it.
 *
 * What is left is the repeatable, whole-Site, user-initiated "Check again", which
 * is the action a plan limit can honestly mean. Before this rule every Site run
 * was unmetered, so the allowance only applied to the legacy new-URL path and a
 * Free Site could be re-checked without limit.
 */
export async function requestSiteRun(input: RunInput, options: { reuseOnly?: true } = {}): Promise<{
  runId: string
  auditId: string | null
  outcomeIds: string[]
  reused: boolean
}> {
  if (!(input.operator && input.scope === 'ACCOUNT_CHECKS' && input.accountMode === 'cleanup')) await requireActiveAccount(input.userId)
  if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId)
  const selection = validateRunSelection(input)
  const { scope, environment } = selection
  const requestedKey = input.idempotencyKey?.trim() || `${input.source.toLowerCase()}:${randomUUID()}`
  const key = { projectId: input.projectId, source: input.source, idempotencyKey: requestedKey }
  const keyOwner = { userId: input.userId, operator: input.operator, scheduled: Boolean(input.scheduledClaim),
    cleanup: Boolean(input.operator && scope === 'ACCOUNT_CHECKS' && input.accountMode === 'cleanup') }
  const responsibilityHash = input.expectedResponsibilityHash ? (await import('./run-retry')).admittedResponsibilityHash : null
  function assertResponsibility(spec: ExecutionSpec | null) {
    if (!responsibilityHash) return
    if (!spec || responsibilityHash(spec) !== input.expectedResponsibilityHash)
      throw new SiteRunRefusal('This run’s admitted scope cannot be reproduced with the current configuration. Start a new check with its current scope.', 409, 'RETRY_SCOPE_CHANGED')
  }
  function matchesRecorded(run: Parameters<typeof sameRecordedRunCommand>[0]) {
    if (!sameRecordedRunCommand(run, input)) return false
    assertResponsibility(readExecutionSpec(run.executionSpec))
    return true
  }
  async function replayRecorded() {
    if (!input.idempotencyKey?.trim()) return null
    const recorded = await loadOwnedRunRequestByKey({ ...key, ...keyOwner })
    if (!recorded) return null
    if (!matchesRecorded(recorded))
      throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    return { runId: recorded.id, auditId: recorded.auditId,
      outcomeIds: recorded.selections.map(item => item.outcomeId).sort(), reused: true }
  }
  const replay = await replayRecorded()
  if (replay) return replay

  const { selectedIds, first, fixture, auditUrl, executionSpec, requestHash, outcomeAuthorization } = await resolveRunExecution(input, selection)
  assertResponsibility(executionSpec)
  const matchesIntent = (run: { requestHash?: string | null; executionSpec?: unknown; selections?: Array<{ outcomeId: string }>; verificationTarget?: Prisma.JsonValue | null }) => {
    const admitted = readExecutionSpec(run.executionSpec)
    if (admitted && admitted.scope !== executionSpec.scope) return false
    if (executionSpec.category && (!admitted?.category || admitted.category.area !== executionSpec.category.area)) return false
    // Recompute valid historical snapshots so their prior row ordering remains
    // replayable without trusting a different executable responsibility.
    return run.requestHash ? (admitted ? executionIntentHash(admitted) : run.requestHash) === requestHash
      : sameExecutionScope(run, selectedIds, input.verificationTarget)
  }
  const replaySelection = (run: { selections?: Array<{ outcomeId: string }> }) => scope === 'SITE' || scope === 'CATEGORY'
    ? (run.selections ?? []).map(selection => selection.outcomeId).sort() : selectedIds
  const compatibleActive = (run: Parameters<typeof matchesIntent>[0] & { executionSpec?: unknown; context?: unknown }) => {
    if (!matchesIntent(run)) return false
    if (input.scheduledClaim && recordedWatchTargetRevision(run.context) !== (input.scheduledClaim.targetRevision ?? 1)) return false
    const admitted = readExecutionSpec(run.executionSpec)
    if (scope === 'CATEGORY' && (admitted?.category?.sourceAuditId !== executionSpec.category?.sourceAuditId ||
      canonicalIntent(admitted?.category?.pages) !== canonicalIntent(executionSpec.category?.pages))) return false
    if ((admitted?.consoleObservationMs ?? 0) < (executionSpec.consoleObservationMs ?? 0)) return false
    if (executionSpec.consoleObservationScopes?.some(scope => scope.minimumMs >
      (admitted?.consoleObservationScopes?.find(prior => prior.pageUrl === scope.pageUrl)?.minimumMs ?? admitted?.consoleObservationMs ?? 2000))) return false
    if (scope !== 'SITE' && scope !== 'CATEGORY') return true
    return admitted?.scope === scope && monitoringExecutionCovers(admitted, executionSpec) &&
      canonicalIntent(canonicalExecutionOutcomes(admitted.outcomes)) === canonicalIntent(canonicalExecutionOutcomes(executionSpec.outcomes)) &&
      outcomeAuthorization.outcomes.every(({ id, revision }) => admittedOutcomeAuthorization(run.context, id) === revision)
  }

  const retainShared = (run: { id: string; auditId: string | null; selections?: Array<{ outcomeId: string }> }) => input.idempotencyKey?.trim()
    ? retainSharedRunKey({ ...key, userId: input.userId, runRequestId: run.id, operator: input.operator, scheduled: Boolean(input.scheduledClaim),
      cleanup: Boolean(input.operator && scope === 'ACCOUNT_CHECKS' && input.accountMode === 'cleanup') },
    (recorded, exactReplay) => recorded.environment === environment && (exactReplay ? matchesRecorded(recorded) : compatibleActive(recorded)))
    : Promise.resolve(run)

  // Clear any run that no worker still owns before deciding whether this Site is
  // busy. Without this the abandoned row keeps failing the partial unique index
  // below, and the customer gets an error instead of a verification.
  await reclaimExpiredOutcomeRuns(input.projectId, input.operator ? { actor: input.operator, projectId: input.projectId,
    userId: input.userId, cleanup: keyOwner.cleanup } : undefined)

  const active = await prisma.runRequest.findFirst({
    where: activeRunWhere(input.projectId, new Date()),
    orderBy: { requestedAt: 'desc' },
    include: { selections: { select: { outcomeId: true } } },
  })
  if (active) {
    if (active.environment !== environment || !compatibleActive(active)) {
      throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')
    }
    const shared = await retainShared(active)
    return { runId: shared.id, auditId: shared.auditId, outcomeIds: replaySelection(shared), reused: true }
  }
  if (options.reuseOnly) throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')


  if (!OPEN_BETA_ACCESS && (input.source === 'WEB' || input.source === 'MCP' || input.source === 'API')) {
    const recentRuns = await prisma.runRequest.count({
      where: {
        projectId: input.projectId,
        source: { in: ['WEB', 'MCP', 'API'] },
        requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (recentRuns >= INTERACTIVE_RUN_LIMIT_PER_DAY) throw new RateLimitError(60 * 60)
  }

  if (scope === 'CATEGORY' || scope === 'ACCOUNT_CHECKS' || scope === 'FIXTURE_SETUP') await requireExecutionReady(scope)
  const run = { id: randomUUID() }
  const runAdmission: Prisma.RunRequestUncheckedCreateInput & { id: string } = {
        id: run.id,
        projectId: input.projectId,
        // Compatibility-only dual-write. The complete selection relation below
        // remains authoritative, including multi-Outcome and diagnostic runs.
        legacyOutcomeId: selectedIds[0] ?? null,
        environment,
        // Take the lease at creation so a run that never reaches a worker still
        // expires instead of blocking the Site indefinitely.
        leaseUntil: new Date(Date.now() + RUN_LEASE_MS),
        selections: selectedIds.length
          ? { create: selectedIds.map((outcomeId) => ({ outcomeId })) }
          : undefined,
        requestedByUserId: input.operator?.actorId ?? input.userId,
        source: input.source,
        idempotencyKey: requestedKey,
        context: { ...safeContext(input.context), outcomeAuthorization },
        executionSpec: executionSpec as Prisma.InputJsonValue,
        requestHash,
        verificationTarget: input.verificationTarget as Prisma.InputJsonValue | undefined,
      }

  try {
    const categoryParent = executionSpec.category ? await prisma.audit.findFirst({
      where: { projectId: input.projectId, status: 'COMPLETED', AND: [
        { executionSpec: { path: ['scope'], equals: 'CATEGORY' } },
        { executionSpec: { path: ['category', 'area'], equals: executionSpec.category.area } },
        { executionSpec: { path: ['category', 'sourceAuditId'], equals: executionSpec.category.sourceAuditId } },
        analysisEnvironmentWhere(environment),
      ] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true },
    }) : null
    const parentAuditId = fixture ? undefined : input.verificationTarget?.parentAuditId ?? input.parentAuditId ?? categoryParent?.id ?? executionSpec.category?.sourceAuditId
    const parent = parentAuditId
      ? await prisma.audit.findFirst({
          where: {
            id: parentAuditId,
            projectId: input.projectId,
            ...(executionSpec.verificationSources && input.verificationTarget?.kind === 'DIAGNOSTIC' ? {} : { status: 'COMPLETED' as const }),
            AND: [analysisEnvironmentWhere(environment)],
          },
          select: { id: true },
        })
      : fixture ? null : await prisma.audit.findFirst({
          where: { projectId: input.projectId, status: 'COMPLETED', url: auditUrl,
            ...(scope === 'SITE' ? siteWideAnalysisAuditWhere : siteAnalysisAuditWhere), AND: [analysisEnvironmentWhere(environment)] },
          orderBy: { completedAt: 'desc' },
          select: { id: true },
        })
    if (parentAuditId && !parent)
      throw new SiteRunRefusal('Verification source is no longer available', 409)
    const started = await createAndEnqueueAudit({
      admission: {
        kind: 'site-run', parentId: parent?.id, request: runAdmission, executionSpec,
        scheduledClaim: input.scheduledClaim, operator: input.operator,
        ...(input.expectedResponsibilityHash ? { preservePreparedScope: true } : {}),
        verificationAttemptId: input.verificationTarget?.attemptId ?? input.verificationAttemptId,
      },
      url: executionSpec.targetUrl,
      userId: input.userId,
      auditMode: input.source === 'WATCH' ? 'CRITICAL_PATH' : 'SINGLE',
      useProjectScanAccess: !fixture,
      attribution: buildAttribution({
        url: auditUrl,
        source: auditSource(input.source),
      }),
    })
    const outcomeIds = started.admittedOutcomeIds ?? selectedIds
    await recordSiteLifecycleEvent({
      name: 'outcome_run_requested',
      idempotencyKey: `outcome-run-requested:${run.id}`,
      userId: input.userId,
      projectId: input.projectId,
      properties: {
        source: input.source.toLowerCase(),
        kind: first?.kind ?? 'diagnostic',
        outcomeCount: outcomeIds.length,
        reused: started.reused,
      },
    }).catch((error) => {
      logger.error('Outcome run request telemetry failed', { runId: run.id, error })
    })
    return { runId: run.id, auditId: started.auditId, outcomeIds, reused: started.reused }
  } catch (error) {
    if (error instanceof RunAdmissionReplay) {
      assertResponsibility(readExecutionSpec(error.executionSpec))
      return { runId: error.runId, auditId: error.auditId, outcomeIds: scope === 'SITE' || scope === 'CATEGORY' ? error.outcomeIds : selectedIds, reused: true }
    }
    // Admission can commit before its response is lost. Recover its immutable
    // receipt through the same authority and command checks as an ordinary retry.
    const replay = await replayRecorded()
    if (replay) return replay
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await prisma.runRequest.findFirst({
        where: { projectId: input.projectId, status: { in: ['QUEUED', 'RUNNING'] } },
        include: { selections: { select: { outcomeId: true } }, audit: { select: { projectId: true } } },
      })
      if (concurrent) {
        if (concurrent.audit && concurrent.audit.projectId !== input.projectId ||
          concurrent.environment !== environment || !compatibleActive(concurrent))
          throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')
        const shared = await retainShared(concurrent)
        return { runId: shared.id, auditId: shared.auditId, outcomeIds: replaySelection(shared), reused: true }
      }
    }
    // Admission refusal rolls back both ledgers. There is no orphan request to fail.

    throw error
  }
}

export async function requestOutcomeRun(input: Omit<RunInput, 'outcomeIds'> & { outcomeId: string }) {
  return requestSiteRun({ ...input, outcomeIds: [input.outcomeId] })
}

/** The caller must authorize the Site. Resolve only that Site's original source. */
export async function loadRunSourceEnvironment(projectId: string, auditId: string): Promise<string> {
  const [source] = await prisma.$queryRaw<Array<{ environment: string | null }>>(Prisma.sql`
    SELECT ${analysisEnvironmentValueSql} AS environment FROM "audits" "source"
    WHERE "source"."projectId" = ${projectId} AND "source"."id" = ${auditId}`)
  if (!source?.environment) throw new SiteRunRefusal('Verification source environment is unavailable', 409, 'SOURCE_ENVIRONMENT_UNAVAILABLE')
  return source.environment
}

export async function findReusableVerificationRun(input: {
  projectId: string
  source: RunRequestSource
  idempotencyKey: string
  outcomeIds: string[]
  verificationTargetKind: SiteRunVerificationTarget['kind']
  verificationIdentity?: { outcomeId?: string; pageUrl?: string; checkId?: string; attemptId?: string }
}): Promise<{ runId: string; auditId: string; environment: string; outcomeIds: string[]; verificationTarget: SiteRunVerificationTarget } | null> {
  const selectedIds = [...new Set(input.outcomeIds)].sort()
  const existing = await loadRunRequestByKey({ projectId: input.projectId, source: input.source, idempotencyKey: input.idempotencyKey })
  if (!existing) return null
  const target = readVerificationTarget(existing.verificationTarget)
  if (
    !existing.auditId || !target ||
    !sameSelection(existing, selectedIds) ||
    target.kind !== input.verificationTargetKind ||
    (input.verificationIdentity && Object.entries(input.verificationIdentity).some(([key, value]) =>
      value !== undefined && target[key as keyof typeof target] !== value))
  ) {
    throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
  }
  const environment = await loadRunSourceEnvironment(input.projectId, existing.auditId)
  if (existing.environment !== environment) throw new SiteRunRefusal('Verification receipt environment does not match its observation', 409)
  return { runId: existing.id, auditId: existing.auditId, environment, outcomeIds: selectedIds, verificationTarget: target }
}
