import { reconcileScheduledCompletions } from './scheduled-completion'
import { persistOutcomeAssessment } from './outcome-incidents'
import { readOutcomeIncident } from '../domain/outcome-incident'
import { executionTransaction, executionWrite } from '@/lib/audit/execution-ownership'
import { bindingEvaluator, recordedBindingEvaluator } from '../domain/outcome-evaluation'
import { prisma } from '@/lib/db'
import { Prisma, type OutcomeBindingExecution } from '@prisma/client'
import { ACTIVE_RUN_STATUSES } from './run-leases'
import { assessRequiredBindings } from './binding-assessment'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { validateBindingForOutcome } from './binding-config'
import { logger } from '@/lib/logger'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'
import { outcomeFlagFingerprint } from '@/lib/audit/flag-identity'
import { recordedBindingVersion } from '../domain/assessment-comparability'
import { recordedCheckoutScope } from '../domain/outcome-proof'
import { lockAdminSiteOperation, type AdminSiteOperationScope } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'

function recoveryWriter(auditId: string, authority?: AdminSiteOperationScope) {
  if (!authority) return executionWrite
  return <T>(write: (tx: Prisma.TransactionClient) => Promise<T>) => executionTransaction(async tx => {
    await lockAdminSiteOperation(authority, tx, auditId)
    return write(tx)
  })
}

async function loadCheckoutReview(input: {
  auditId: string; projectId: string; auditSpec: unknown; outcomeId: string;
  binding: { key: string; version: number; config: Prisma.JsonValue };
  execution: OutcomeBindingExecution | undefined;
}) {
  const { auditId, projectId, auditSpec, outcomeId, binding, execution } = input
  if (execution?.mechanism !== 'BROWSER_JOURNEY' || recordedBindingVersion(execution) !== binding.version) return null
  const detail = execution.detail
  let match: Prisma.JourneyReviewWhereInput
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'journeyReviewId' in detail) {
    if (typeof detail.journeyReviewId !== 'string' || !detail.journeyReviewId) return null
    match = { id: detail.journeyReviewId }
  } else {
    // Historical walks identify their binding in the steps. That key is
    // attributable only when the admitted Audit assigned it to one Checkout.
    const owners = readExecutionSpec(auditSpec)?.outcomes.filter(outcome => outcome.kind === 'CHECKOUT' &&
      outcome.bindings.some(candidate => candidate.key === binding.key && candidate.required && candidate.mechanism === 'BROWSER_JOURNEY'))
    if (owners?.length !== 1 || owners[0].id !== outcomeId) return null
    const validated = validateBindingForOutcome('CHECKOUT', 'BROWSER_JOURNEY', binding.config)
    if (!validated.success) return null
    match = { startUrl: validated.data.config.startUrl, steps: { some: { actionDetail: { path: ['bindingKey'], equals: binding.key } } } }
  }
  const reviews = await prisma.journeyReview.findMany({
    where: { ...match, auditId, journeyType: 'checkout', audit: { projectId } },
    take: 2, select: { id: true, steps: { orderBy: { stepNumber: 'asc' }, select: { screenshotAfterUrl: true } } },
  })
  return reviews.length === 1 ? reviews[0] : null
}

export async function reconcileOutcomeRunsForAudit(auditId: string, authority?: AdminSiteOperationScope): Promise<number> {
  const writeRecovery = recoveryWriter(auditId, authority)
  const requests = await prisma.runRequest.findMany({
    where: { auditId, status: { in: [...ACTIVE_RUN_STATUSES] },
      ...(authority ? { projectId: authority.projectId, project: { userId: authority.userId }, audit: { userId: authority.userId } } : {}) },
    include: {
      selections: { include: { outcome: { include: { bindings: { where: { enabled: true } } } } } },
      audit: { select: { projectId: true, completedAt: true, executionSpec: true } },
    },
  })
  let settled = 0
  for (const request of requests) {
    if (request.audit?.projectId !== request.projectId) continue
    const currentRun = { id: request.id, projectId: request.projectId, auditId,
      audit: { projectId: request.projectId }, status: { in: [...ACTIVE_RUN_STATUSES] } }
    const specification = readExecutionSpec(request.executionSpec)
    if (request.executionSpec != null && !specification) throw new Error('Invalid admitted execution specification')
    if (specification?.scope === 'ACCOUNT_CHECKS') {
      const task = await prisma.auditExecutionTask.findFirst({ where: { auditId, workKind: 'automatic-accounts' }, select: { workState: true, workErrorCode: true } })
      const result = await writeRecovery(tx => tx.runRequest.updateMany({ where: currentRun,
        data: { status: task?.workState === 'COMPLETED' ? 'COMPLETED' : 'FAILED', completedAt: new Date(), leaseUntil: null, errorCode: task?.workErrorCode ?? null } }))
      settled += result.count
      continue
    }
    if (specification?.scope === 'FIXTURE_SETUP') {
      const task = await prisma.auditExecutionTask.findFirst({ where: { auditId, workKind: 'fixture-setup' },
        select: { workState: true, workErrorCode: true } })
      const result = await writeRecovery(tx => tx.runRequest.updateMany({ where: currentRun,
        data: { status: task?.workState === 'COMPLETED' ? 'COMPLETED' : 'FAILED', completedAt: new Date(), leaseUntil: null,
          errorCode: task?.workErrorCode ?? null } }))
      settled += result.count
      continue
    }
    const selections = request.selections.filter(item => item.outcome.projectId === request.projectId)
    for (const selection of selections) {
      const outcome = selection.outcome
      const admitted = specification?.outcomes.find(item => item.id === outcome.id)
      if (specification && !admitted) continue
      const requiredBindings = admitted
        ? admitted.bindings.filter(binding => binding.required).map(binding => ({ ...binding, config: binding.config as Prisma.JsonValue, scope: binding.scope as Prisma.JsonValue }))
        : outcome.bindings.filter((binding) => binding.required)
      const executions = await prisma.outcomeBindingExecution.findMany({
        where: { auditId, outcomeId: outcome.id },
      })
      {
        const observations = executions.map(execution => {
          const binding = requiredBindings.find(item => item.key === execution.bindingKey)
          const expected = bindingEvaluator(admitted?.kind ?? outcome.kind, binding?.mechanism ?? execution.mechanism, binding?.config)
          const wrongMethod = binding && execution.mechanism && binding.mechanism !== execution.mechanism
          const changedEvaluation = execution.disposition === 'SUCCEEDED' && expected !== recordedBindingEvaluator(execution.detail)
          return { key: execution.bindingKey, disposition: wrongMethod || changedEvaluation ? 'BLOCKED' as const : execution.disposition,
            reason: wrongMethod ? 'binding_changed' : changedEvaluation ? 'evaluation_changed' : execution.reason,
            version: recordedBindingVersion(execution) }
        })
        const verdict = assessRequiredBindings(
          requiredBindings.map((binding) => ({ key: binding.key, required: binding.required, version: binding.version })),
          observations,
        )
        const outcomeKind = admitted?.kind ?? outcome.kind
        const checkoutBinding = requiredBindings.find((binding) => binding.mechanism === 'BROWSER_JOURNEY' && outcomeKind === 'CHECKOUT')
        // Only failures that counted toward the verdict may name a repair.
        const failures = executions.flatMap((execution, index) => {
          if (observations[index].disposition !== 'FAILED' || !verdict.observedBindings.includes(execution.bindingKey)) return []
          const { detail } = execution
          const id = detail && typeof detail === 'object' && !Array.isArray(detail) && typeof detail.failureFlagId === 'string'
            ? detail.failureFlagId : undefined
          return [{ key: execution.bindingKey, id, fingerprint: outcomeFlagFingerprint(outcome.id, execution.bindingKey) }]
        })
        const evidenceBinding = checkoutBinding && (requiredBindings.find(binding => binding.mechanism === 'BROWSER_JOURNEY' &&
          binding.key === failures[0]?.key) ?? checkoutBinding)
        const review = evidenceBinding ? await loadCheckoutReview({
          auditId, projectId: request.projectId, auditSpec: request.audit?.executionSpec, outcomeId: outcome.id,
          binding: evidenceBinding, execution: executions.find(execution => execution.bindingKey === evidenceBinding.key),
        }) : null
        const flagScope = { auditId, audit: { projectId: request.projectId } }
        const flags = failures.length ? await prisma.flag.findMany({
          where: { ...flagScope, OR: failures.map(({ id, fingerprint }) => ({ id, fingerprint })) },
          orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true },
        }) : []
        let legacyFlag: { id: string } | undefined
        const sameKind = (specification?.outcomes ?? selections.map(item => item.outcome))
          .filter(item => item.kind === outcomeKind)
        // Older captures can lack binding fingerprints. Retain their link only
        // when one binding, one Outcome and one candidate explain the failure.
        if (!flags.length && requiredBindings.length === 1 && failures.length === 1 &&
          sameKind.length === 1 && sameKind[0].id === outcome.id) {
          const legacy = await prisma.flag.findMany({
            where: { ...flagScope, id: failures[0].id, ...(checkoutBinding ? {
              checkId: { startsWith: 'journey-checkout-failed-' },
              OR: [{ fingerprint: null }, { fingerprint: { startsWith: 'journey:journey-checkout-failed-' } }],
            } : { fingerprint: `outcome:${outcomeKind.toLowerCase()}:${failures[0].key}` }) },
            take: 2, select: { id: true },
          })
          if (legacy.length === 1) legacyFlag = legacy[0]
        }
        const times = executions.flatMap(execution => execution.createdAt ? [execution.createdAt.getTime()] : [])
        const assessedAt = times.length ? new Date(Math.max(...times)) : request.audit?.completedAt ?? new Date()
        const validUntil = verdict.state === 'COULD_NOT_VERIFY'
          ? assessedAt
          : new Date(assessedAt.getTime() + outcome.staleAfterMinutes * 60_000)
        const assessment = await persistOutcomeAssessment({
          projectId: request.projectId, bindingKeys: requiredBindings.map(binding => binding.key),
          failureFlagIds: flags.map(item => item.id), legacyFailureFlagId: legacyFlag?.id, outcomeKind,

            outcomeId: outcome.id,
            runRequestId: request.id,
            auditId,
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
              policy: admitted?.bindingPolicy ?? outcome.bindingPolicy,
              requiredBindings: verdict.requiredBindings,
              observedBindings: verdict.observedBindings,
              scope: checkoutBinding?.scope ?? null,
              bindings: requiredBindings.map((binding) => {
                const validated = validateBindingForOutcome(outcome.kind, binding.mechanism, binding.config)
                const fixture = admitted?.bindings.find(item => item.key === binding.key)?.fixture
                const detail = executions.find(item => item.bindingKey === binding.key)?.detail
                const evaluator = recordedBindingEvaluator(detail)
                const checkoutScope = outcomeKind === 'CHECKOUT' ? recordedCheckoutScope(detail) : {}
                const result = verdict.observedBindings.includes(binding.key) ? observations.find(item => item.key === binding.key)?.disposition : undefined
                return { ...(evaluator ? { evaluator } : {}), key: binding.key, mechanism: binding.mechanism, version: binding.version, ...(fixture ? { fixture } : {}),
                  ...(result === 'SUCCEEDED' || result === 'FAILED' ? { result } : {}),
                  ...checkoutScope,
                  config: validated.success ? validated.data.config : null, scope: binding.scope }
              }) as unknown as Prisma.InputJsonArray,
            },
            assessedAt,
            validUntil,
        }, authority)
        await recordSiteLifecycleEvent({
          name: 'outcome_run_result',
          idempotencyKey: `outcome-run-result:${request.id}:${outcome.id}`,
          userId: request.requestedByUserId,
          projectId: request.projectId,
          properties: {
            state: assessment.state.toLowerCase(),
            kind: outcome.kind.toLowerCase(),
            source: request.source.toLowerCase(),
            latencyMs: assessedAt.getTime() - request.requestedAt.getTime(),
          },
        }).catch((error) => {
          logger.error('Outcome run result telemetry failed', { runId: request.id, error })
        })
        if (readOutcomeIncident(assessment.evidence)?.transition === 'recovery' && assessment.improvementId) {
          await recordSiteLifecycleEvent({
            name: 'outcome_recovered',
            idempotencyKey: `outcome-recovered:${request.id}:${outcome.id}:${assessment.improvementId}`,
            userId: request.requestedByUserId,
            projectId: request.projectId,
            properties: { kind: outcome.kind },
          }).catch((error) => {
            logger.error('Outcome recovery telemetry failed', { runId: request.id, error })
          })
        }
      }
    }
    // Broad conclusions depend on the immutable comparison publication. Binding
    // assessments above must exist first, but cannot publish run completion
    // while readers could still observe a different unfinished conclusion.
    if (specification?.scope === 'SITE' || specification?.scope === 'CATEGORY') {
      if (!await prisma.auditVerifierExecution.findFirst({ where: { auditId,
        targetKey: FLAG_COMPARISON_TARGET, status: 'COMPLETED' }, select: { id: true } })) continue
    }
    const result = await writeRecovery(tx => tx.runRequest.updateMany({
      where: currentRun,
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        errorCode: null,
        errorMessage: null,
        leaseUntil: null,
      },
    }))
    settled += result.count
    if (request.context && typeof request.context === 'object' && 'scheduled' in request.context)
      await reconcileScheduledCompletions(1, undefined, { projectId: request.projectId, runId: request.id, authority })
        .catch(error => {
          if (error instanceof AdminActionError) throw error
          logger.warn('Scheduled completion deferred after run settlement', { runId: request.id, error })
        })
  }
  return settled
}

export async function markOutcomeRunsCouldNotVerify(
  auditId: string,
  errorCode: string,
  errorMessage: string,
  authority?: AdminSiteOperationScope,
  requestScope: Prisma.RunRequestWhereInput = {},
): Promise<number> {
  const { settled, assessedAt } = await executionTransaction(async tx => {
    if (authority) await lockAdminSiteOperation(authority, tx, auditId)
    // Take the Audit before changing any RunRequest. The result and every
    // unavailable assessment must commit together before the Site is released.
    const [audit] = await tx.$queryRaw<Array<{ projectId: string | null; completedAt: Date | null }>>`
      SELECT "projectId", "completedAt" FROM audits WHERE id = ${auditId} FOR NO KEY UPDATE`
    const assessedAt = audit?.completedAt ?? new Date()
    if (!audit?.projectId) return { settled: [], assessedAt }
    const where: Prisma.RunRequestWhereInput = { auditId, projectId: audit.projectId, status: { in: [...ACTIVE_RUN_STATUSES] }, AND: [requestScope,
      ...(authority ? [{ projectId: authority.projectId, project: { userId: authority.userId }, audit: { userId: authority.userId } }] : [])] }
    const requests = await tx.runRequest.findMany({ where,
      include: { selections: { where: { outcome: { projectId: audit.projectId } },
        include: { outcome: { include: { bindings: { where: { enabled: true } } } } } } },
    })
    const settled: typeof requests = []
    for (const request of requests) {
      const updated = await tx.runRequest.updateMany({ where: { ...where, id: request.id }, data: {
        status: 'FAILED', errorCode, errorMessage, completedAt: assessedAt, leaseUntil: null,
      } })
      if (updated.count !== 1) continue
      const specification = readExecutionSpec(request.executionSpec)
      const projected: typeof request.selections = []
      for (const selection of request.selections) {
        const admitted = specification?.outcomes.find(outcome => outcome.id === selection.outcomeId)
        if (request.executionSpec != null && !admitted) continue
        const bindings = request.executionSpec == null ? selection.outcome.bindings : admitted?.bindings ?? []
        await tx.outcomeAssessment.upsert({
          where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: selection.outcomeId } },
          create: {
            outcomeId: selection.outcomeId, runRequestId: request.id, auditId, state: 'COULD_NOT_VERIFY',
            summary: 'FixFlags could not complete this verification.', evidence: { reason: errorCode },
            coverage: { environment: request.environment, requiredBindings: bindings.filter(binding => binding.required).map(binding => binding.key),
              observedBindings: [] },
            assessedAt, validUntil: assessedAt,
          },
          update: {},
        })
        projected.push(selection)
      }
      settled.push({ ...request, selections: projected })
    }
    return { settled, assessedAt }
  })
  for (const request of settled) {
    for (const selection of request.selections) {
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
    if (request.context && typeof request.context === 'object' && 'scheduled' in request.context)
      await reconcileScheduledCompletions(1, undefined, { projectId: request.projectId, runId: request.id, authority })
        .catch(error => {
          if (error instanceof AdminActionError) throw error
          logger.warn('Scheduled completion deferred after run settlement', { runId: request.id, error })
        })
  }
  return settled.length
}
