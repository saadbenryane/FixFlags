import { randomUUID } from 'node:crypto'
import { Prisma, type RunRequestSource } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'
import { assessRequiredBindings } from '@/lib/sites/application/binding-assessment'
import { checkoutResultCopy, currentOutcomeState } from '@/lib/sites/outcome-state'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { RateLimitError } from '@/lib/security/rate-limit'
import { logger } from '@/lib/logger'

const ACTIVE_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const
const INTERACTIVE_RUN_LIMIT_PER_DAY = 24
/**
 * How long an unfinished run may hold its Site. Long enough that a slow browser
 * verification is never treated as abandoned, short enough that a dead worker's
 * run stops blocking the Site within one Watch interval.
 */
const RUN_LEASE_MS = 30 * 60 * 1000
/** Exported so the worker renews exactly the lease the run command takes. */
export const OUTCOME_RUN_LEASE_MS = RUN_LEASE_MS

/**
 * A run only blocks its Site while it is genuinely in flight.
 *
 * QUEUED and RUNNING are both written before a worker has confirmed the run
 * finished, so a worker death strands the row. Reusing a stranded run would hand
 * the caller a stale audit and silently stop Watch from verifying. So only a live
 * lease counts as in flight: a NULL or expired lease means no worker still owns
 * the run. NULL is treated as expired deliberately, because historical rows
 * predate the column and must never block a Site.
 *
 * The lease is a filter, not a lock. Overlapping requests are still serialised by
 * the unique (projectId, source, idempotencyKey) constraint and the single
 * physical Audit per run.
 */
function activeRunWhere(projectId: string, now: Date): Prisma.RunRequestWhereInput {
  return {
    projectId,
    status: { in: [...ACTIVE_RUN_STATUSES] },
    // Only a live lease counts as in flight. A NULL or expired lease is a run no
    // worker still owns, so it must not block the Site.
    leaseUntil: { gt: now },
  }
}

/**
 * Finish runs that no worker still owns, so they stop blocking their Site.
 *
 * The lease filter alone is not enough. `run_requests_one_active_site_idx` is a
 * partial unique index over `(projectId) WHERE status IN ('QUEUED','RUNNING')`,
 * and a partial index predicate cannot call `now()`, so the database keeps
 * treating an abandoned run as active and rejects any replacement. A query that
 * merely stops counting the stranded run would trade a stale result for a write
 * failure, which is not an improvement.
 *
 * So expiry has to be made terminal, and it is decided where the customer is
 * actually blocked: at the point a new run is requested. Waiting for a periodic
 * sweep would leave a Free Site blocked for a whole Watch interval, because
 * those Sites are only checked weekly.
 *
 * A run whose audit already finished is reconciled rather than failed. The worker
 * may have died after verifying but before recording it, and that result is real,
 * so discarding it would throw away a completed verification.
 */
export async function reclaimExpiredOutcomeRuns(projectId: string): Promise<number> {
  const now = new Date()
  const stranded = await prisma.runRequest.findMany({
    where: {
      projectId,
      status: { in: [...ACTIVE_RUN_STATUSES] },
      // Mirrors the inverse of activeRunWhere: anything without a live lease.
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    },
    select: { id: true, auditId: true },
  })
  if (stranded.length === 0) return 0

  let reclaimed = 0
  for (const run of stranded) {
    if (run.auditId) {
      let auditStatus: string | null = null
      try {
        const audit = await prisma.audit.findUnique({
          where: { id: run.auditId },
          select: { status: true },
        })
        auditStatus = audit?.status ?? null
      } catch (error) {
        // Falling through to failing the run is safe: it unblocks the Site, and
        // the audit itself is still recovered by the stuck-audit sweep.
        logger.warn('Could not read the audit of an abandoned Outcome run', { runId: run.id, error })
      }
      if (auditStatus === 'COMPLETED') {
        try {
          // The verification landed. Reclaim it as its real result, not a failure.
          await reconcileOutcomeRunsForAudit(run.auditId)
          reclaimed += 1
          continue
        } catch (error) {
          // A failed reconciliation must not leave the Site blocked. The run still
          // has to become terminal so the partial unique index stops rejecting.
          logger.error('Could not reconcile an abandoned Outcome run', { runId: run.id, error })
        }
      }
    }
    const failed = await prisma.runRequest.updateMany({
      // The earlier read is only a candidate list. A worker can renew its lease
      // before this write, so expiry must be re-checked atomically here or a
      // live run can be clobbered as abandoned.
      where: {
        id: run.id,
        status: { in: [...ACTIVE_RUN_STATUSES] },
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: {
        status: 'FAILED',
        errorCode: 'RUN_ABANDONED',
        errorMessage: 'FixFlags could not finish this verification in time and will try again.',
        completedAt: now,
        leaseUntil: null,
      },
    })
    if (failed.count === 1) {
      reclaimed += 1
      logger.warn('Reclaimed an abandoned Outcome run', { runId: run.id, projectId })
    }
  }
  return reclaimed
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

export async function requestSiteRun(input: RunInput): Promise<{
  runId: string
  auditId: string | null
  outcomeIds: string[]
  reused: boolean
}> {
  const selectedIds = [...new Set(input.outcomeIds)].sort()
  const scope = input.scope ?? 'OUTCOMES'
  if (scope === 'SITE' && (selectedIds.length > 0 || input.verificationTarget)) {
    throw new Error('Site care cannot select an Outcome or Flag verification target')
  }
  if (scope !== 'SITE' && selectedIds.length === 0 && input.verificationTarget?.kind !== 'DIAGNOSTIC') {
    throw new Error('Select at least one Outcome')
  }
  if (
    input.verificationTarget?.kind === 'OUTCOME' &&
    !selectedIds.includes(input.verificationTarget.outcomeId)
  ) {
    throw new Error('Verification target must be included in the Outcome selection')
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
  if (outcomes.length !== selectedIds.length) throw new Error('Outcome not found')
  const environment = input.environment ?? 'production'
  if (outcomes.some((outcome) => outcome.environment !== environment)) {
    throw new Error('Outcome is not configured for this environment')
  }
  const first = outcomes.find((outcome) => outcome.id === selectedIds[0]) ?? null
  const project = first?.project ?? await prisma.project.findFirst({
    where: { id: input.projectId, userId: input.userId, deletedAt: null },
    select: { url: true },
  })
  if (!project) throw new Error('Site not found')

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
      throw new Error('Run idempotency key belongs to another Site run')
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
      throw new Error('Another Site run is already in progress')
    }
    return { runId: active.id, auditId: active.auditId, outcomeIds: selectedIds, reused: true }
  }

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
        context: safeContext(input.context),
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
          throw new Error('Another Site run is already in progress')
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
    const auditUrl = input.verificationTarget?.kind === 'DIAGNOSTIC'
      ? input.verificationTarget.pageUrl
      : input.url ?? (input.source === 'WATCH' || !singleStart ? project.url : singleStart)
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
      throw new Error('Verification source is no longer available')
    const started = await createAndEnqueueAudit({
      url: auditUrl,
      userId: input.userId,
      parentId: parent?.id,
      recheckTrigger: input.source === 'WATCH' ? 'WATCH' : 'MANUAL',
      auditMode: input.source === 'WATCH' ? 'CRITICAL_PATH' : 'SINGLE',
      monitoringMode: input.source === 'WATCH' ? 'FULL' : undefined,
      skipUsageCount: true,
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
    await prisma.runRequest.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorCode: 'RUN_START_FAILED',
        errorMessage: 'FixFlags could not start this verification.',
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
    throw new Error('Run idempotency key belongs to another Site run')
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

export async function reconcileOutcomeRunsForAudit(auditId: string): Promise<void> {
  const requests = await prisma.runRequest.findMany({
    where: { auditId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    include: {
      selections: { include: { outcome: { include: { bindings: { where: { enabled: true } } } } } },
      audit: {
        include: {
          journeyReviews: {
            where: { journeyType: 'checkout' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { steps: { orderBy: { stepNumber: 'asc' } } },
          },
        },
      },
    },
  })
  for (const request of requests) {
    for (const selection of request.selections) {
      const outcome = selection.outcome
      const requiredBindings = outcome.bindings.filter((binding) => binding.required)
      const executions = await prisma.outcomeBindingExecution.findMany({
        where: { auditId, outcomeId: outcome.id },
      })
      {
        const verdict = assessRequiredBindings(
          requiredBindings.map((binding) => ({ key: binding.key, required: binding.required })),
          executions.map((execution) => ({
            key: execution.bindingKey,
            disposition: execution.disposition,
            reason: execution.reason,
          })),
        )
        const checkoutBinding = requiredBindings.find((binding) => binding.mechanism === 'BROWSER_JOURNEY' && outcome.kind === 'CHECKOUT')
        const review = checkoutBinding ? request.audit?.journeyReviews[0] : null
        const flag = verdict.state === 'FLAG' && checkoutBinding
          ? await prisma.flag.findFirst({
              where: { auditId, checkId: { startsWith: 'journey-checkout-failed-' } },
              select: { id: true, checkId: true },
            })
          : verdict.state === 'FLAG'
            ? await prisma.flag.findFirst({
                where: { auditId, fingerprint: { startsWith: `outcome:${outcome.kind.toLowerCase()}` } },
                select: { id: true, checkId: true },
              })
            : null
        const occurrence = flag
          ? await prisma.improvementOccurrence.findUnique({
              where: { flagId: flag.id },
              include: { improvement: true },
            })
          : null
        if (occurrence && occurrence.improvement.outcomeId !== outcome.id) {
          await prisma.improvement.update({
            where: { id: occurrence.improvementId },
            data: { outcomeId: outcome.id },
          })
        }
        const linkedImprovement = occurrence?.improvement ?? (verdict.state === 'FLAG'
          ? await prisma.improvement.findFirst({
              where: { projectId: request.projectId, outcomeId: outcome.id },
              orderBy: { updatedAt: 'desc' },
            })
          : null)
        const assessedAt = new Date()
        const validUntil = verdict.state === 'COULD_NOT_VERIFY'
          ? assessedAt
          : new Date(assessedAt.getTime() + outcome.staleAfterMinutes * 60_000)
        await prisma.outcomeAssessment.upsert({
          where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: outcome.id } },
          create: {
            outcomeId: outcome.id,
            runRequestId: request.id,
            auditId,
            improvementId: linkedImprovement?.id,
            state: verdict.state,
            summary: checkoutBinding && verdict.state !== 'COULD_NOT_VERIFY'
              ? checkoutResultCopy(verdict.reason === 'required_bindings_succeeded' ? 'checkout_reached' : verdict.reason).summary
              : verdict.summary,
            evidence: {
              journeyReviewId: review?.id ?? null,
              stepCount: review?.steps.length ?? 0,
              screenshots: review?.steps.map((step) => step.screenshotAfterUrl).filter(Boolean) ?? [],
              reason: verdict.reason,
            },
            coverage: {
              environment: request.environment,
              policy: outcome.bindingPolicy,
              requiredBindings: verdict.requiredBindings,
              observedBindings: verdict.observedBindings,
              scope: checkoutBinding?.scope ?? null,
            },
            assessedAt,
            validUntil,
          },
          update: {},
        })
        await recordSiteLifecycleEvent({
          name: 'outcome_run_result',
          idempotencyKey: `outcome-run-result:${request.id}:${outcome.id}`,
          userId: request.requestedByUserId,
          projectId: request.projectId,
          properties: {
            state: verdict.state.toLowerCase(),
            kind: outcome.kind.toLowerCase(),
            source: request.source.toLowerCase(),
            latencyMs: assessedAt.getTime() - request.requestedAt.getTime(),
          },
        }).catch((error) => {
          logger.error('Outcome run result telemetry failed', { runId: request.id, error })
        })
        if (verdict.state === 'CLEAR' && linkedImprovement?.status === 'VERIFIED') {
          await recordSiteLifecycleEvent({
            name: 'outcome_recovered',
            idempotencyKey: `outcome-recovered:${request.id}:${outcome.id}:${linkedImprovement.id}`,
            userId: request.requestedByUserId,
            projectId: request.projectId,
            properties: { kind: outcome.kind },
          }).catch((error) => {
            logger.error('Outcome recovery telemetry failed', { runId: request.id, error })
          })
        }
      }
    }
    await prisma.runRequest.update({
      where: { id: request.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        leaseUntil: null,
      },
    })
  }
}

export async function markOutcomeRunsCouldNotVerify(
  auditId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const requests = await prisma.runRequest.findMany({
    where: { auditId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    include: { selections: { include: { outcome: { include: { bindings: { where: { enabled: true } } } } } } },
  })
  for (const request of requests) {
    const assessedAt = new Date()
    for (const selection of request.selections) {
      await prisma.outcomeAssessment.upsert({
        where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: selection.outcomeId } },
        create: {
          outcomeId: selection.outcomeId,
          runRequestId: request.id,
          auditId,
          state: 'COULD_NOT_VERIFY',
          summary: 'FixFlags could not complete this verification.',
          evidence: { reason: errorCode },
          coverage: {
            environment: request.environment,
            requiredBindings: selection.outcome.bindings.filter((binding) => binding.required).map((binding) => binding.key),
            observedBindings: [],
          },
          assessedAt,
          validUntil: assessedAt,
        },
        update: {},
      })
      await recordSiteLifecycleEvent({
        name: 'outcome_run_result',
        idempotencyKey: `outcome-run-result:${request.id}:${selection.outcomeId}`,
        userId: request.requestedByUserId,
        projectId: request.projectId,
        properties: {
          state: 'could_not_verify',
          source: request.source.toLowerCase(),
          kind: selection.outcome.kind.toLowerCase(),
          latencyMs: assessedAt.getTime() - request.requestedAt.getTime(),
        },
      }).catch((error) => {
        logger.error('Inconclusive Outcome telemetry failed', { runId: request.id, error })
      })
    }
    await prisma.runRequest.update({
      where: { id: request.id },
      data: {
        status: 'FAILED',
        errorCode,
        errorMessage,
        completedAt: assessedAt,
        leaseUntil: null,
      },
    })
  }
}

export async function getOwnedRun(userId: string, runId: string) {
  const run = await prisma.runRequest.findFirst({
    where: { id: runId, project: { userId, deletedAt: null } },
    include: {
      selections: { include: { outcome: true } },
      assessments: true,
      audit: { select: { progress: true } },
    },
  })
  if (!run) return null
  const primarySelection = run.selections[0] ?? null
  const primaryAssessment = primarySelection
    ? run.assessments.find((item) => item.outcomeId === primarySelection.outcomeId) ?? null
    : null
  const outcomes = run.selections.map((selection) => {
    const assessment = run.assessments.find((item) => item.outcomeId === selection.outcomeId)
    return {
      outcomeId: selection.outcomeId,
      outcomeName: selection.outcome.name,
      result: assessment ? currentOutcomeState(assessment) : null,
      summary: assessment?.summary ?? null,
      coverage: assessment?.coverage ?? null,
      evidence: assessment?.evidence ?? null,
      assessedAt: assessment?.assessedAt.toISOString() ?? null,
      validUntil: assessment?.validUntil.toISOString() ?? null,
    }
  })
  const states = outcomes.map((outcome) => outcome.result)
  const result = states.includes('FLAG') ? 'FLAG'
    : states.includes('COULD_NOT_VERIFY') ? 'COULD_NOT_VERIFY'
      : states.includes('STALE') ? 'STALE'
        : states.length > 0 && states.every((state) => state === 'CLEAR') ? 'CLEAR'
          : run.status === 'FAILED' ? 'FAILED' : null
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
    outcomeId: primarySelection?.outcomeId ?? null,
    outcomeName: primarySelection?.outcome.name ?? null,
    outcomes,
    verificationTarget: run.verificationTarget,
    result,
    summary: outcomes.length === 1
      ? primaryAssessment?.summary ?? null
      : result === 'CLEAR' ? 'All selected Outcomes were verified Clear.'
        : result === 'FLAG' ? 'At least one selected Outcome has a Flag.'
          : result === 'COULD_NOT_VERIFY' ? 'At least one selected Outcome could not be verified.'
            : result === 'STALE' ? 'At least one selected Outcome is Stale.' : null,
    auditId: run.auditId,
    requestedAt: run.requestedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.errorMessage,
  }
}
