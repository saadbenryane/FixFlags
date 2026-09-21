import { randomUUID } from 'node:crypto'
import type { Prisma, RunRequestSource } from '@prisma/client'
import { prisma } from '@/lib/db'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { buildAttribution } from '@/lib/leads/attribution'
import { checkoutResultCopy, currentOutcomeState } from '@/lib/sites/outcome-state'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'

const ACTIVE_RUN_STATUSES = ['QUEUED', 'RUNNING'] as const

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
    Object.entries(value).filter(
      ([key, item]) =>
        !/(url|email|prompt|evidence|html|content|message|secret|token)/i.test(key) &&
        item !== undefined,
    ),
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

  const run = await prisma.runRequest.create({
    data: {
      projectId: input.projectId,
      outcomeId: outcome.id,
      requestedByUserId: input.userId,
      source: input.source,
      idempotencyKey: requestedKey,
      context: safeContext(input.context),
    },
  })

  try {
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
          where: { projectId: input.projectId, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          select: { id: true },
        })
    if (input.parentAuditId && !parent)
      throw new Error('Verification source is no longer available')
    const binding = outcome.bindings[0]!
    const config = binding.config as Record<string, unknown>
    const startUrl = typeof config.startUrl === 'string' ? config.startUrl : outcome.project!.url
    const started = await createAndEnqueueAudit({
      url: startUrl,
      userId: input.userId,
      parentId: parent?.id,
      recheckTrigger: input.source === 'WATCH' ? 'WATCH' : 'MANUAL',
      auditMode: 'SINGLE',
      skipUsageCount: true,
      useProjectScanAccess: true,
      verificationAttemptId: input.verificationAttemptId,
      reuseActiveManual: false,
      runRequestId: run.id,
      attribution: buildAttribution({
        url: startUrl,
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
    const copy = checkoutResultCopy(
      flag?.id ? (flag.checkId?.replace('journey-checkout-failed-', '') ?? reason) : reason,
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
          reason,
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
  }
}

export async function getOwnedRun(userId: string, runId: string) {
  const run = await prisma.runRequest.findFirst({
    where: { id: runId, project: { userId, deletedAt: null } },
    include: {
      outcome: true,
      assessment: true,
      audit: { select: { status: true, progress: true } },
    },
  })
  if (!run) return null
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
    outcomeId: run.outcomeId,
    outcomeName: run.outcome.name,
    result: run.assessment ? currentOutcomeState(run.assessment) : null,
    summary: run.assessment?.summary ?? null,
    auditId: run.auditId,
    requestedAt: run.requestedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.errorMessage,
  }
}
