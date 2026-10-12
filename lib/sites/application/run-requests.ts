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
import { siteAnalysisAuditWhere,siteWideAnalysisAuditWhere } from './analysis-scope'
import { canonicalExecutionOutcomes,executionIntentHash } from './execution-spec'
import { activeRunWhere,reclaimExpiredRuns,RUN_LEASE_MS } from './run-leases'
import { reconcileOutcomeRunsForAudit } from './run-reconciliation'
import { resolveRunExecution,validateRunSelection } from './run-selection'
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

import { safeContext,sameExecutionScope,sameSelection,verificationTargetKind,type RunInput,type SiteRunVerificationTarget } from './run-intent'
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
  const selection = validateRunSelection(input)
  const { scope, environment } = selection
  const { selectedIds, first, fixture, auditUrl, executionSpec, requestHash } = await resolveRunExecution(input, selection)
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
      throw new SiteRunRefusal('Another Site run is already in progress', 409)
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
        requestedByUserId: input.userId,
        source: input.source,
        idempotencyKey: requestedKey,
        context: safeContext(input.context),
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
        { executionSpec: { path: ['environment'], equals: executionSpec.environment } },
      ] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true },
    }) : null
    const parentAuditId = fixture ? undefined : input.verificationTarget?.parentAuditId ?? input.parentAuditId ?? categoryParent?.id ?? executionSpec.category?.sourceAuditId
    const parent = parentAuditId
      ? await prisma.audit.findFirst({
          where: {
            id: parentAuditId,
            projectId: input.projectId,
            status: 'COMPLETED',
          },
          select: { id: true },
        })
      : fixture ? null : await prisma.audit.findFirst({
          where: { projectId: input.projectId, status: 'COMPLETED', url: auditUrl,
            ...(scope === 'SITE' ? siteWideAnalysisAuditWhere : siteAnalysisAuditWhere) },
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
          throw new SiteRunRefusal('Another Site run is already in progress', 409)
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

export async function findReusableRun(input: {
  projectId: string
  source: RunRequestSource
  idempotencyKey: string
  outcomeIds: string[]
  environment?: string
  verificationTargetKind?: SiteRunVerificationTarget['kind']
  verificationIdentity?: { outcomeId?: string; pageUrl?: string; checkId?: string; attemptId?: string }
}): Promise<{ runId: string; auditId: string | null; outcomeIds: string[]; verificationTarget: SiteRunVerificationTarget | null } | null> {
  const selectedIds = [...new Set(input.outcomeIds)].sort()
  const environment = input.environment ?? 'production'
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
    existing.environment !== environment ||
    !sameSelection(existing, selectedIds) ||
    verificationTargetKind(existing.verificationTarget) !== (input.verificationTargetKind ?? null) ||
    (input.verificationIdentity && (!target || Object.entries(input.verificationIdentity).some(([key, value]) =>
      value !== undefined && target[key as keyof typeof target] !== value)))
  ) {
    throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
  }
  return { runId: existing.id, auditId: existing.auditId, outcomeIds: selectedIds, verificationTarget: target }
}

/** Retry a failed Outcome run without changing its Outcome set, or a legacy check when no run exists. */
export async function retryFailedExecution(auditId: string): Promise<
  | { ok: true; auditId: string | null; runId: string | null }
  | { ok: false; status: number; error: string }
> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, url: true, userId: true, projectId: true, status: true },
  })
  if (!audit) return { ok: false, status: 404, error: 'Audit not found' }
  if (audit.status !== 'FAILED') return { ok: false, status: 409, error: 'Only failed audits can be retried' }
  const run = audit.projectId
    ? await prisma.runRequest.findFirst({
        where: { auditId, projectId: audit.projectId },
        include: { selections: { select: { outcomeId: true } } },
      })
    : null
  if (run && audit.userId && audit.projectId) {
    const outcomeIds = run.selections.map((selection) => selection.outcomeId)
    const setup = readExecutionSpec(run.executionSpec)?.fixtureSetup
    if (readExecutionSpec(run.executionSpec)?.scope === 'ACCOUNT_CHECKS') {
      const intent = readExecutionSpec(run.executionSpec)!.accountChecks!
      const started = await requestSiteRun({ projectId: audit.projectId, userId: audit.userId, source: 'INTERNAL', outcomeIds: [], scope: 'ACCOUNT_CHECKS', accountMode: intent.mode, idempotencyKey: `internal-retry:${audit.id}:${run.id}` })
      return { ok: true, auditId: started.auditId, runId: started.runId }
    }
    if (setup) {
      const started = await requestSiteRun({ projectId: audit.projectId, userId: audit.userId, outcomeIds: [], source: 'INTERNAL',
        scope: 'FIXTURE_SETUP', fixtureId: setup.id, idempotencyKey: `internal-retry:${audit.id}:${run.id}` })
      return { ok: true, auditId: started.auditId, runId: started.runId }
    }
    if (outcomeIds.length > 0 || !run.verificationTarget) {
      const started = await requestSiteRun({
        projectId: audit.projectId,
        outcomeIds,
        userId: audit.userId,
        source: 'INTERNAL',
        scope: outcomeIds.length > 0 ? 'OUTCOMES' : 'SITE',
        idempotencyKey: `internal-retry:${audit.id}:${run.id}`,
        url: audit.url,
      })
      return { ok: true, auditId: started.auditId, runId: started.runId }
    }
  }
  if (!audit.userId || !audit.projectId) return { ok: false, status: 409, error: 'This check has no owner to retry' }
  const outcomes = await prisma.siteOutcome.findMany({
    where: { projectId: audit.projectId, enabled: true },
    select: { id: true },
    orderBy: { id: 'asc' },
  })
  if (outcomes.length === 0) {
    return { ok: false, status: 409, error: 'Confirm an Outcome before retrying this check.' }
  }
  const started = await requestSiteRun({
    projectId: audit.projectId,
    outcomeIds: outcomes.map((outcome) => outcome.id),
    userId: audit.userId,
    source: 'INTERNAL',
    idempotencyKey: `internal-retry:${audit.id}:site`,
    url: audit.url,
  })
  return { ok: true, auditId: started.auditId, runId: started.runId }
}
