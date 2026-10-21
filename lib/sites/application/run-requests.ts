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
import { canonicalIntent,readExecutionSpec,readVerificationTarget } from '../domain/execution-spec'
import { analysisEnvironmentValueSql,analysisEnvironmentWhere,siteAnalysisAuditWhere,siteWideAnalysisAuditWhere } from './analysis-scope'
import { canonicalExecutionOutcomes,executionIntentHash } from './execution-spec'
import { activeRunWhere,reclaimExpiredRuns,RUN_LEASE_MS } from './run-leases'
import { reconcileOutcomeRunsForAudit } from './run-reconciliation'
import { resolveRunExecution,validateRunSelection } from './run-selection'
import { requireActiveAccount } from '@/lib/auth/account-availability'
import { assertAdminDomainActor } from '@/lib/admin/domain-actor'
export { getOwnedRun } from './run-queries'
export { markOutcomeRunsCouldNotVerify,reconcileOutcomeRunsForAudit } from './run-reconciliation'

const INTERACTIVE_RUN_LIMIT_PER_DAY = 24

export type { RunInput,SiteRunVerificationTarget } from './run-intent'
export { OUTCOME_RUN_LEASE_MS } from './run-leases'

export function reclaimExpiredOutcomeRuns(projectId: string): Promise<number> {
  return reclaimExpiredRuns(projectId, reconcileOutcomeRunsForAudit)
}

function auditSource(source: RunRequestSource) {
  if (source === 'MCP') return 'MCP' as const
  if (source === 'API' || source === 'DEPLOYMENT' || source === 'INTEGRATION') return 'API' as const
  return 'DASHBOARD' as const
}

import { safeContext,sameExecutionScope,sameSelection,type RunInput,type SiteRunVerificationTarget } from './run-intent'
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
function consumesScanAllowance(scope: NonNullable<RunInput['scope']>, source: RunRequestSource): boolean {
  return (scope === 'SITE' || scope === 'CATEGORY') && source !== 'WATCH'
}

export async function requestSiteRun(input: RunInput): Promise<{
  runId: string
  auditId: string | null
  outcomeIds: string[]
  reused: boolean
}> {
  if (!(input.operator && input.scope === 'ACCOUNT_CHECKS' && input.accountMode === 'cleanup')) await requireActiveAccount(input.userId)
  if (input.operator) await assertAdminDomainActor(input.operator, input.userId, input.projectId)
  const selection = validateRunSelection(input)
  const { scope, environment } = selection
  const { selectedIds, first, fixture, auditUrl, executionSpec, requestHash, outcomeAuthorization } = await resolveRunExecution(input, selection)
  if (input.expectedResponsibilityHash) {
    const { admittedResponsibilityHash } = await import('./run-retry')
    if (admittedResponsibilityHash(executionSpec) !== input.expectedResponsibilityHash)
      throw new SiteRunRefusal('This run’s admitted scope cannot be reproduced with the current configuration. Start a new check with its current scope.', 409, 'RETRY_SCOPE_CHANGED')
  }
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
  const compatibleActive = (run: Parameters<typeof matchesIntent>[0] & { executionSpec?: unknown }) => {
    if (!matchesIntent(run)) return false
    const admitted = readExecutionSpec(run.executionSpec)
    if (scope === 'CATEGORY' && (admitted?.category?.sourceAuditId !== executionSpec.category?.sourceAuditId ||
      canonicalIntent(admitted?.category?.pages) !== canonicalIntent(executionSpec.category?.pages))) return false
    if ((admitted?.consoleObservationMs ?? 0) < (executionSpec.consoleObservationMs ?? 0)) return false
    if (executionSpec.consoleObservationScopes?.some(scope => scope.minimumMs >
      (admitted?.consoleObservationScopes?.find(prior => prior.pageUrl === scope.pageUrl)?.minimumMs ?? admitted?.consoleObservationMs ?? 2000))) return false
    if (scope !== 'SITE' && scope !== 'CATEGORY') return true
    return admitted?.scope === scope && canonicalIntent(canonicalExecutionOutcomes(admitted.outcomes)) === canonicalIntent(canonicalExecutionOutcomes(executionSpec.outcomes))
  }

  const requestedKey =
    input.idempotencyKey?.trim() || `${input.source.toLowerCase()}:${randomUUID()}`
  const byKey = await prisma.runRequest.findUnique({
    where: {
      projectId_source_idempotencyKey: {
        projectId: input.projectId,
        source: input.source,
        idempotencyKey: requestedKey,
      },
    },
    include: { selections: { select: { outcomeId: true } } },
  })
  if (byKey) {
    if (byKey.projectId !== input.projectId || byKey.environment !== environment || !matchesIntent(byKey)) {
      throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    }
    return { runId: byKey.id, auditId: byKey.auditId, outcomeIds: replaySelection(byKey), reused: true }
  }

  // Clear any run that no worker still owns before deciding whether this Site is
  // busy. Without this the abandoned row keeps failing the partial unique index
  // below, and the customer gets an error instead of a verification.
  await reclaimExpiredOutcomeRuns(input.projectId)

  const active = await prisma.runRequest.findFirst({
    where: activeRunWhere(input.projectId, new Date()),
    orderBy: { requestedAt: 'desc' },
    include: { selections: { select: { outcomeId: true } } },
  })
  if (active) {
    if (active.environment !== environment || !compatibleActive(active)) {
      throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')
    }
    return { runId: active.id, auditId: active.auditId, outcomeIds: replaySelection(active), reused: true }
  }


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
  const runAdmission: Prisma.RunRequestUncheckedCreateInput = {
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
            status: 'COMPLETED', AND: [analysisEnvironmentWhere(environment)],
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
      url: executionSpec.targetUrl,
      userId: input.userId,
      parentId: parent?.id,
      recheckTrigger: input.source === 'WATCH' ? 'WATCH' : 'MANUAL',
      auditMode: input.source === 'WATCH' ? 'CRITICAL_PATH' : 'SINGLE',
      monitoringMode: input.source === 'WATCH' ? 'FULL' : undefined,
      skipUsageCount: !consumesScanAllowance(scope, input.source),
      useProjectScanAccess: !fixture,
      verificationAttemptId: input.verificationTarget?.attemptId ?? input.verificationAttemptId,
      reuseActiveManual: false,
      runRequestId: run.id,
      runRequestAdmission: runAdmission,
      scheduledClaim: input.scheduledClaim,
      operator: input.operator,
      executionSpec,
      attribution: buildAttribution({
        url: auditUrl,
        source: auditSource(input.source),
      }),
    })
    await recordSiteLifecycleEvent({
      name: 'outcome_run_requested',
      idempotencyKey: `outcome-run-requested:${run.id}`,
      userId: input.userId,
      projectId: input.projectId,
      properties: {
        source: input.source.toLowerCase(),
        kind: first?.kind ?? 'diagnostic',
        outcomeCount: selectedIds.length,
        reused: started.reused,
      },
    }).catch((error) => {
      logger.error('Outcome run request telemetry failed', { runId: run.id, error })
    })
    return { runId: run.id, auditId: started.auditId, outcomeIds: selectedIds, reused: started.reused }
  } catch (error) {
    if (error instanceof RunAdmissionReplay)
      return { runId: error.runId, auditId: error.auditId, outcomeIds: scope === 'SITE' ? error.outcomeIds : selectedIds, reused: true }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await prisma.runRequest.findFirst({
        where: { projectId: input.projectId, OR: [
          { source: input.source, idempotencyKey: requestedKey },
          { status: { in: ['QUEUED', 'RUNNING'] } },
        ] }, include: { selections: { select: { outcomeId: true } } },
      })
      if (concurrent) {
        const identicalKey = concurrent.source === input.source && concurrent.idempotencyKey === requestedKey
        if (concurrent.environment !== environment || !(identicalKey ? matchesIntent(concurrent) : compatibleActive(concurrent)))
          throw new SiteRunRefusal('Another Site run is already in progress', 409, 'SITE_RUN_IN_PROGRESS')
        return { runId: concurrent.id, auditId: concurrent.auditId, outcomeIds: replaySelection(concurrent), reused: true }
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
  const existing = await prisma.runRequest.findUnique({
    where: {
      projectId_source_idempotencyKey: {
        projectId: input.projectId,
        source: input.source,
        idempotencyKey: input.idempotencyKey,
      },
    },
    include: { selections: { select: { outcomeId: true } } },
  })
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
