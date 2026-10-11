import { reconcileOutcomeRunsForAudit } from './run-reconciliation'
export { reconcileOutcomeRunsForAudit, markOutcomeRunsCouldNotVerify } from './run-reconciliation'
export { getOwnedRun } from './run-queries'
import { RUN_LEASE_MS, activeRunWhere, reclaimExpiredRuns } from './run-leases'
import { randomUUID } from 'node:crypto'
import { Prisma, type RunRequestSource } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit, AuditLimitError } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { RateLimitError } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'
import { requireExecutionReady } from '@/lib/queue/execution-readiness'
import { normalizeAuditUrl } from '@/lib/audit/url'

const INTERACTIVE_RUN_LIMIT_PER_DAY = 24

export { OUTCOME_RUN_LEASE_MS } from './run-leases'

export function reclaimExpiredOutcomeRuns(projectId: string): Promise<number> {
  return reclaimExpiredRuns(projectId, reconcileOutcomeRunsForAudit)
}

function auditSource(source: RunRequestSource) {
  if (source === 'MCP') return 'MCP' as const
  if (source === 'API' || source === 'DEPLOYMENT' || source === 'INTEGRATION') return 'API' as const
  return 'DASHBOARD' as const
}

function safeContext(
  value: Record<string, string | number | boolean | null | undefined> | undefined,
): Prisma.InputJsonObject | undefined {
  if (!value) return undefined
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          !/(url|email|prompt|evidence|html|content|message|secret|token)/i.test(key) &&
          item !== undefined,
      )
      .map(([key, item]) => {
        if (typeof item !== 'string') return [key, item]
        const trimmed = item.trim().slice(0, 160)
        const sensitive = /(?:https?:\/\/|bearer\s+|api[_-]?key|password|secret|token)/i.test(trimmed)
        return [key, sensitive ? '[redacted]' : trimmed]
      }),
  ) as Prisma.InputJsonObject
}

export type SiteRunVerificationTarget =
  | {
      kind: 'OUTCOME'
      outcomeId: string
      attemptId: string
      parentAuditId: string
    }
  | {
      kind: 'DIAGNOSTIC'
      pageUrl: string
      checkId: string
      attemptId: string
      parentAuditId: string
    }

export type RunInput = {
  projectId: string
  outcomeIds: string[]
  userId: string
  source: RunRequestSource
  /** Broad Site care has no Outcome selection but still uses this same durable command. */
  scope?: 'OUTCOMES' | 'SITE'
  environment?: string
  idempotencyKey?: string
  context?: Record<string, string | number | boolean | null | undefined>
  verificationAttemptId?: string
  parentAuditId?: string
  /** Page a Flag verify must recheck. Bindings still start from their own configuration. */
  url?: string
  verificationTarget?: SiteRunVerificationTarget
}

function sameSelection(
  run: { selections?: Array<{ outcomeId: string }> },
  selectedIds: string[],
): boolean {
  const stored = (run.selections ?? []).map((selection) => selection.outcomeId).sort()
  return stored.length === selectedIds.length && stored.every((id, index) => id === selectedIds[index])
}

function verificationTargetIdentity(value: Prisma.JsonValue | SiteRunVerificationTarget | null | undefined): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const target = value as Record<string, unknown>
  if (target.kind === 'OUTCOME') {
    return JSON.stringify(['OUTCOME', target.outcomeId, target.attemptId, target.parentAuditId])
  }
  if (target.kind === 'DIAGNOSTIC') {
    return JSON.stringify(['DIAGNOSTIC', target.pageUrl, target.checkId, target.attemptId, target.parentAuditId])
  }
  return JSON.stringify(value)
}

function verificationTargetKind(value: Prisma.JsonValue | SiteRunVerificationTarget | null | undefined): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const kind = (value as Record<string, unknown>).kind
  return typeof kind === 'string' ? kind : null
}

function sameExecutionScope(
  run: { selections?: Array<{ outcomeId: string }>; verificationTarget?: Prisma.JsonValue | null },
  selectedIds: string[],
  verificationTarget: SiteRunVerificationTarget | undefined,
): boolean {
  return sameSelection(run, selectedIds) &&
    verificationTargetIdentity(run.verificationTarget) === verificationTargetIdentity(verificationTarget)
}

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
function consumesScanAllowance(scope: 'OUTCOMES' | 'SITE', source: RunRequestSource): boolean {
  return scope === 'SITE' && source !== 'WATCH'
}

export async function requestSiteRun(input: RunInput): Promise<{
  runId: string
  auditId: string | null
  outcomeIds: string[]
  reused: boolean
}> {
  const selectedIds = [...new Set(input.outcomeIds)].sort()
  const scope = input.scope ?? 'OUTCOMES'
  if (scope === 'SITE' && (selectedIds.length > 0 || input.verificationTarget)) {
    throw new SiteRunRefusal('Site care cannot select an Outcome or Flag verification target', 400)
  }
  if (scope !== 'SITE' && selectedIds.length === 0 && input.verificationTarget?.kind !== 'DIAGNOSTIC') {
    throw new SiteRunRefusal('Select at least one Outcome', 400)
  }
  if (
    input.verificationTarget?.kind === 'OUTCOME' &&
    !selectedIds.includes(input.verificationTarget.outcomeId)
  ) {
    throw new SiteRunRefusal('Verification target must be included in the Outcome selection', 400)
  }
  const outcomes = await prisma.siteOutcome.findMany({
    where: {
      id: { in: selectedIds },
      projectId: input.projectId,
      enabled: true,
      project: { userId: input.userId, deletedAt: null },
    },
    include: {
      project: { select: { url: true } },
      bindings: {
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (outcomes.length !== selectedIds.length) throw new SiteRunRefusal('Outcome not found', 404)
  const environment = input.environment ?? 'production'
  if (outcomes.some((outcome) => outcome.environment !== environment)) {
    throw new SiteRunRefusal('Outcome is not configured for this environment', 400)
  }
  const first = outcomes.find((outcome) => outcome.id === selectedIds[0]) ?? null
  const project = first?.project ?? await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId, deletedAt: null },
    select: { url: true },
  })
  if (!project) throw new SiteRunRefusal('Site not found', 404)

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
    if (byKey.projectId !== input.projectId || byKey.environment !== environment || !sameExecutionScope(byKey, selectedIds, input.verificationTarget)) {
      throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
    }
    return { runId: byKey.id, auditId: byKey.auditId, outcomeIds: selectedIds, reused: true }
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
    if (active.environment !== environment || !sameExecutionScope(active, selectedIds, input.verificationTarget)) {
      throw new SiteRunRefusal('Another Site run is already in progress', 409)
    }
    return { runId: active.id, auditId: active.auditId, outcomeIds: selectedIds, reused: true }
  }

  if (input.source !== 'WATCH') await requireExecutionReady()

  if (input.source === 'WEB' || input.source === 'MCP' || input.source === 'API') {
    const recentRuns = await prisma.runRequest.count({
      where: {
        projectId: input.projectId,
        source: { in: ['WEB', 'MCP', 'API'] },
        requestedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })
    if (recentRuns >= INTERACTIVE_RUN_LIMIT_PER_DAY) throw new RateLimitError(60 * 60)
  }

  let run: { id: string }
  try {
    run = await prisma.runRequest.create({
      data: {
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
        context: { ...safeContext(input.context), bindingVersions: Object.fromEntries(outcomes.map(outcome => [outcome.id,
          Object.fromEntries(outcome.bindings.map(binding => [binding.key, binding.version]))])) },
        verificationTarget: input.verificationTarget as Prisma.InputJsonValue | undefined,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await prisma.runRequest.findFirst({
        where: activeRunWhere(input.projectId, new Date()),
        orderBy: { requestedAt: 'desc' },
        include: { selections: { select: { outcomeId: true } } },
      })
      if (concurrent) {
        if (concurrent.environment !== environment || !sameExecutionScope(concurrent, selectedIds, input.verificationTarget)) {
          throw new SiteRunRefusal('Another Site run is already in progress', 409)
        }
        return { runId: concurrent.id, auditId: concurrent.auditId, outcomeIds: selectedIds, reused: true }
      }
      const sameKey = await prisma.runRequest.findUnique({
        where: {
          projectId_source_idempotencyKey: {
            projectId: input.projectId,
            source: input.source,
            idempotencyKey: requestedKey,
          },
        },
        include: { selections: { select: { outcomeId: true } } },
      })
      if (sameKey && sameKey.environment === environment && sameExecutionScope(sameKey, selectedIds, input.verificationTarget)) {
        return { runId: sameKey.id, auditId: sameKey.auditId, outcomeIds: selectedIds, reused: true }
      }
    }
    throw error
  }

  try {
    const single = outcomes.length === 1 ? outcomes[0] : null
    const singleRequired = single?.bindings.filter((binding) => binding.required) ?? []
    const singleConfig = singleRequired.length === 1 ? singleRequired[0]!.config as Record<string, unknown> : null
    const singleStart = typeof singleConfig?.startUrl === 'string' ? singleConfig.startUrl : null
    // Watch and multi-Outcome runs enter at the Site. One bound Outcome can
    // start at its own page. Each binding still executes from its own config.
    const requestedUrl = input.verificationTarget?.kind === 'DIAGNOSTIC'
      ? input.verificationTarget.pageUrl
      : input.url ?? (input.source === 'WATCH' || !singleStart ? project.url : singleStart)
    const normalized = normalizeAuditUrl(requestedUrl)
    const auditUrl = normalized.ok ? normalized.url : requestedUrl
    const parentAuditId = input.verificationTarget?.parentAuditId ?? input.parentAuditId
    const parent = parentAuditId
      ? await prisma.audit.findFirst({
          where: {
            id: parentAuditId,
            projectId: input.projectId,
            status: 'COMPLETED',
          },
          select: { id: true },
        })
      : await prisma.audit.findFirst({
          where: { projectId: input.projectId, status: 'COMPLETED', url: auditUrl },
          orderBy: { completedAt: 'desc' },
          select: { id: true },
        })
    if (parentAuditId && !parent)
      throw new SiteRunRefusal('Verification source is no longer available', 409)
    const started = await createAndEnqueueAudit({
      url: auditUrl,
      userId: input.userId,
      parentId: parent?.id,
      recheckTrigger: input.source === 'WATCH' ? 'WATCH' : 'MANUAL',
      auditMode: input.source === 'WATCH' ? 'CRITICAL_PATH' : 'SINGLE',
      monitoringMode: input.source === 'WATCH' ? 'FULL' : undefined,
      skipUsageCount: !consumesScanAllowance(scope, input.source),
      useProjectScanAccess: true,
      verificationAttemptId: input.verificationTarget?.attemptId ?? input.verificationAttemptId,
      reuseActiveManual: false,
      runRequestId: run.id,
      attribution: buildAttribution({
        url: auditUrl,
        source: auditSource(input.source),
      }),
    })
    await prisma.runRequest.update({
      where: { id: run.id },
      data: { auditId: started.auditId },
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
    // A blocked run still has to say why. Overwriting a plan-limit reason with a
    // generic start failure would tell a customer whose Site they are watching
    // that FixFlags simply could not start, which is both false and unactionable.
    const limit = error instanceof AuditLimitError ? error : null
    await prisma.runRequest.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorCode: limit ? limit.code : 'RUN_START_FAILED',
        errorMessage: limit ? limit.message : 'FixFlags could not start this verification.',
        completedAt: new Date(),
        leaseUntil: null,
      },
    })
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
}): Promise<{ runId: string; auditId: string | null; outcomeIds: string[] } | null> {
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
  if (
    existing.environment !== environment ||
    !sameSelection(existing, selectedIds) ||
    verificationTargetKind(existing.verificationTarget) !== (input.verificationTargetKind ?? null)
  ) {
    throw new SiteRunRefusal('Run idempotency key belongs to another Site run', 409)
  }
  return { runId: existing.id, auditId: existing.auditId, outcomeIds: selectedIds }
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
