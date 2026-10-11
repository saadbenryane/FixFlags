import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { ACTIVE_RUN_STATUSES } from './run-leases'
import { assessRequiredBindings } from './binding-assessment'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { validateBindingForOutcome } from './binding-config'
import { logger } from '@/lib/logger'

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
          requiredBindings.map((binding) => ({ key: binding.key, required: binding.required, version: binding.version })),
          executions.map((execution) => ({
            key: execution.bindingKey,
            disposition: execution.disposition,
            reason: execution.reason,
            version: execution.detail && typeof execution.detail === 'object' && !Array.isArray(execution.detail)
              && typeof execution.detail.bindingVersion === 'number' ? execution.detail.bindingVersion : undefined,
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
            // A blocked purchase names its reason. A Checkout that never ran stays a coverage gap.
            summary: checkoutBinding && verdict.reason !== 'required_coverage_incomplete'
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
              bindings: requiredBindings.map((binding) => {
                const validated = validateBindingForOutcome(outcome.kind, binding.mechanism, binding.config)
                return { key: binding.key, mechanism: binding.mechanism, version: binding.version,
                  config: validated.success ? validated.data.config : null, scope: binding.scope }
              }) as unknown as Prisma.InputJsonArray,
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
    await prisma.runRequest.updateMany({
      where: { id: request.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
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
    await prisma.runRequest.updateMany({
      where: { id: request.id, status: { in: [...ACTIVE_RUN_STATUSES] } },
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
