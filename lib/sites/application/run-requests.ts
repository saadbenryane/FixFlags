import { randomUUID } from 'node:crypto'
import { Prisma, type RunRequestSource } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'
import { checkoutResultCopy, currentOutcomeState } from '@/lib/sites/outcome-state'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { RateLimitError } from '@/lib/security/rate-limit'

const ACTIVE_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const
const INTERACTIVE_RUN_LIMIT_PER_DAY = 24

function auditSource(source: RunRequestSource) {
  if (source === 'MCP') return 'MCP' as const
  if (source === 'API') return 'API' as const
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

export async function requestOutcomeRun(input: {
  projectId: string
  outcomeId: string
  userId: string
  source: RunRequestSource
  idempotencyKey?: string
  context?: Record<string, string | number | boolean | null | undefined>
  verificationAttemptId?: string
  parentAuditId?: string
}): Promise<{ runId: string; auditId: string | null; reused: boolean }> {
  const outcome = await prisma.siteOutcome.findFirst({
    where: {
      id: input.outcomeId,
      projectId: input.projectId,
      enabled: true,
      project: { userId: input.userId, deletedAt: null },
    },
    include: {
      project: { select: { url: true } },
      bindings: {
        where: { enabled: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      },
    },
  })
  if (!outcome) throw new Error('Outcome not found')
  if (outcome.bindings.length === 0) throw new Error('Outcome has no active execution binding')

  const requestedKey =
    input.idempotencyKey?.trim() || `${input.source.toLowerCase()}:${randomUUID()}`
  const byKey = await prisma.runRequest.findUnique({
    where: { idempotencyKey: requestedKey },
  })
  if (byKey) {
    if (byKey.projectId !== input.projectId || byKey.outcomeId !== input.outcomeId) {
      throw new Error('Run idempotency key belongs to another Outcome')
    }
    return { runId: byKey.id, auditId: byKey.auditId, reused: true }
  }

  const active = await prisma.runRequest.findFirst({
    where: { outcomeId: outcome.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
    orderBy: { requestedAt: 'desc' },
  })
  if (active) return { runId: active.id, auditId: active.auditId, reused: true }

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
        outcomeId: outcome.id,
        requestedByUserId: input.userId,
        source: input.source,
        idempotencyKey: requestedKey,
        context: safeContext(input.context),
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const concurrent = await prisma.runRequest.findFirst({
        where: { outcomeId: outcome.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
        orderBy: { requestedAt: 'desc' },
      })
      if (concurrent) return { runId: concurrent.id, auditId: concurrent.auditId, reused: true }
      const sameKey = await prisma.runRequest.findUnique({ where: { idempotencyKey: requestedKey } })
      if (sameKey?.outcomeId === outcome.id && sameKey.projectId === input.projectId) {
        return { runId: sameKey.id, auditId: sameKey.auditId, reused: true }
      }
    }
    throw error
  }

  try {
    const binding = outcome.bindings[0]!
    const config = binding.config as Record<string, unknown>
    const startUrl = typeof config.startUrl === 'string' ? config.startUrl : outcome.project!.url
    // A scheduled Site check still covers the broad Site. The bound Checkout
    // browser walk runs inside that same Audit, from its own product-page URL.
    const auditUrl = input.source === 'WATCH' ? outcome.project!.url : startUrl
    const parent = input.parentAuditId
      ? await prisma.audit.findFirst({
          where: {
            id: input.parentAuditId,
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
    if (input.parentAuditId && !parent)
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
      verificationAttemptId: input.verificationAttemptId,
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
        kind: outcome.kind,
        reused: started.reused,
      },
    }).catch(() => undefined)
    return { runId: run.id, auditId: started.auditId, reused: started.reused }
  } catch (error) {
    await prisma.runRequest.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorCode: 'RUN_START_FAILED',
        errorMessage: 'FixFlags could not start this verification.',
        completedAt: new Date(),
      },
    })
    throw error
  }
}

export async function reconcileOutcomeRunsForAudit(auditId: string): Promise<void> {
  const requests = await prisma.runRequest.findMany({
    where: { auditId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    include: {
      outcome: true,
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
    const review = request.audit?.journeyReviews[0]
    const reason =
      review?.blockedReason ??
      review?.abandonedReason ??
      (review?.goalAchieved ? 'checkout_reached' : 'probe_error')
    const flag = await prisma.flag.findFirst({
      where: { auditId, checkId: { startsWith: 'journey-checkout-failed-' } },
      select: { id: true, checkId: true },
    })
    const occurrence = flag
      ? await prisma.improvementOccurrence.findUnique({
          where: { flagId: flag.id },
          include: { improvement: true },
        })
      : null
    if (occurrence && occurrence.improvement.outcomeId !== request.outcomeId) {
      await prisma.improvement.update({
        where: { id: occurrence.improvementId },
        data: { outcomeId: request.outcomeId },
      })
    }
    const linkedImprovement =
      occurrence?.improvement ??
      (await prisma.improvement.findFirst({
        where: { projectId: request.projectId, outcomeId: request.outcomeId },
        orderBy: { updatedAt: 'desc' },
      }))

    const state = review?.goalAchieved ? 'CLEAR' : flag ? 'FLAG' : 'COULD_NOT_VERIFY'
    const resultReason = flag?.checkId?.replace('journey-checkout-failed-', '') ?? reason
    const copy = checkoutResultCopy(
      resultReason,
    )
    const assessedAt = new Date()
    const validUntil = new Date(assessedAt.getTime() + request.outcome.staleAfterMinutes * 60_000)
    await prisma.outcomeAssessment.upsert({
      where: { runRequestId: request.id },
      create: {
        outcomeId: request.outcomeId,
        runRequestId: request.id,
        auditId,
        improvementId: linkedImprovement?.id,
        state,
        summary: copy.summary,
        evidence: {
          journeyReviewId: review?.id ?? null,
          stepCount: review?.steps.length ?? 0,
          screenshots: review?.steps.map((step) => step.screenshotAfterUrl).filter(Boolean) ?? [],
          reason: resultReason,
        },
        assessedAt,
        validUntil,
      },
      update: {},
    })
    await prisma.runRequest.update({
      where: { id: request.id },
      data: {
        status: 'COMPLETED',
        completedAt: assessedAt,
        errorCode: null,
        errorMessage: null,
      },
    })
    await recordSiteLifecycleEvent({
      name: 'outcome_run_result',
      idempotencyKey: `outcome-run-result:${request.id}`,
      userId: request.requestedByUserId,
      projectId: request.projectId,
      properties: {
        state: state.toLowerCase(),
        source: request.source.toLowerCase(),
        latencyMs: assessedAt.getTime() - request.requestedAt.getTime(),
      },
    }).catch(() => undefined)
    if (state === 'CLEAR' && linkedImprovement?.status === 'VERIFIED') {
      await recordSiteLifecycleEvent({
        name: 'outcome_recovered',
        idempotencyKey: `outcome-recovered:${request.id}:${linkedImprovement.id}`,
        userId: request.requestedByUserId,
        projectId: request.projectId,
        properties: { kind: request.outcome.kind },
      }).catch(() => undefined)
    }
  }
}

export async function markOutcomeRunsCouldNotVerify(
  auditId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  const requests = await prisma.runRequest.findMany({
    where: { auditId, status: { in: [...ACTIVE_RUN_STATUSES] } },
    include: { outcome: true },
  })
  for (const request of requests) {
    const assessedAt = new Date()
    await prisma.outcomeAssessment.upsert({
      where: { runRequestId: request.id },
      create: {
        outcomeId: request.outcomeId,
        runRequestId: request.id,
        auditId,
        state: 'COULD_NOT_VERIFY',
        summary: 'FixFlags could not complete this verification.',
        evidence: { reason: errorCode },
        assessedAt,
        validUntil: assessedAt,
      },
      update: {},
    })
    await prisma.runRequest.update({
      where: { id: request.id },
      data: {
        status: 'FAILED',
        errorCode,
        errorMessage,
        completedAt: assessedAt,
      },
    })
    await recordSiteLifecycleEvent({
      name: 'outcome_run_result',
      idempotencyKey: `outcome-run-result:${request.id}`,
      userId: request.requestedByUserId,
      projectId: request.projectId,
      properties: {
        state: 'could_not_verify',
        source: request.source.toLowerCase(),
        latencyMs: assessedAt.getTime() - request.requestedAt.getTime(),
      },
    }).catch(() => undefined)
  }
}

export async function getOwnedRun(userId: string, runId: string) {
  let run = await prisma.runRequest.findFirst({
    where: { id: runId, project: { userId, deletedAt: null } },
    include: {
      outcome: true,
      assessment: true,
      audit: { select: { status: true, progress: true, improvementProjectedAt: true } },
    },
  })
  if (!run) return null
  if (ACTIVE_RUN_STATUSES.includes(run.status as (typeof ACTIVE_RUN_STATUSES)[number])) {
    if (run.audit?.status === 'FAILED') {
      await markOutcomeRunsCouldNotVerify(
        run.auditId!,
        'AUDIT_FAILED',
        'FixFlags could not complete this verification.',
      )
    } else if (run.audit?.status === 'COMPLETED' && run.audit.improvementProjectedAt) {
      await reconcileOutcomeRunsForAudit(run.auditId!)
    }
    run = await prisma.runRequest.findFirst({
      where: { id: runId, project: { userId, deletedAt: null } },
      include: {
        outcome: true,
        assessment: true,
        audit: { select: { status: true, progress: true, improvementProjectedAt: true } },
      },
    })
    if (!run) return null
  }
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
    outcomeId: run.outcomeId,
    outcomeName: run.outcome.name,
    result: run.assessment
      ? currentOutcomeState(run.assessment)
      : run.status === 'FAILED' ? 'COULD_NOT_VERIFY' : null,
    summary: run.assessment?.summary ?? null,
    auditId: run.auditId,
    requestedAt: run.requestedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.errorMessage,
  }
}
