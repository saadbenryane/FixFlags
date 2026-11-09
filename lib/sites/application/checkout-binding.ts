import { CHECKOUT_ENTRY_EVALUATOR } from '../domain/outcome-evaluation'
import { currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { persistJourneyResult } from '@/lib/audit/journey/run-journey-reviews'
import { outcomeArtifactNamespace } from '@/lib/integrity/artifact-namespace'
import { runPathProbe } from '@/lib/integrity/run-path-probe'
import { checkoutAttemptObservation, checkoutProbeVerdict } from '@/lib/integrity/purchase'
import { checkoutResultCopy } from '@/lib/sites/outcome-state'
import { recordBindingEvidence, type BindingObservation } from './binding-evidence'
import { checkoutDestinationKey } from './checkout-capture'

export async function runCheckoutBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  startUrl: string
  allowLocalhost: boolean
  purchaseControlKey?: string
}): Promise<void> {
  const startedAt = Date.now()
  const result = await runPathProbe({
    runId: outcomeArtifactNamespace(input, currentExecutionOwnership()?.generation ?? 0),
    url: input.startUrl,
    allowLocalhost: input.allowLocalhost,
    ...(input.purchaseControlKey ? { purchaseControlKey: input.purchaseControlKey } : {}),
  })
  const verdict = checkoutProbeVerdict(result)
  const copy = checkoutResultCopy(verdict.reason)
  const isFlag = verdict.isFlag
  const isClear = verdict.isClear
  const destinationKey = checkoutDestinationKey(result.steps.at(-1)?.destinationUrl, result.finalUrl)
  const { reviewId, flagIds } = await persistJourneyResult(input.auditId, {
    journeyType: 'checkout',
    startUrl: input.startUrl,
    status: isClear || isFlag ? 'COMPLETED' : 'ABANDONED',
    goalAchieved: isClear,
    blockedReason: isClear || isFlag ? null : verdict.reason,
    abandonedReason: isClear || isFlag ? null : copy.summary,
    durationMs: Date.now() - startedAt,
    steps: result.steps.map((step, index) => ({
      stepNumber: index + 1,
      actionType: step.label,
      actionDetail: { label: step.label, bindingKey: input.bindingKey,
        ...(step.destinationUrl ? { destinationUrl: step.destinationUrl } : {}) },
      url: step.url,
      screenshotAfterUrl: step.screenshotUrl,
      accessibilityTree: '',
      outcomeMatch: step.label === 'checkout' ? isClear : null,
      outcomeDetail: index === result.steps.length - 1 ? copy.evidence : null,
      reasoning: `Independent Checkout verification: ${step.label}`,
    })),
    findings: isFlag
      ? [
          {
            checkId: `journey-checkout-failed-${verdict.reason}`,
            stepNumber: Math.max(1, result.steps.length),
            url: result.finalUrl,
            rubric: 'EXPERIENCE',
            severity: 'CRITICAL',
            impactTag: 'REVENUE',
            problem: copy.problem,
            evidence: copy.evidence,
            whyItMatters: 'Customers can’t reach checkout while this problem persists.',
            fix: copy.fix,
            screenshotUrl: result.steps.at(-1)?.screenshotUrl ?? null,
            confidence: 0.95,
            findingType: 'dead-end',
          },
        ]
      : [],
    actionTimeline: result.steps.map((step, index) => ({
      t: index,
      kind: 'checkout',
      label: step.label,
      url: step.url,
      screenshot: step.screenshotUrl,
    })),
  }, { outcomeId: input.outcomeId, bindingKey: input.bindingKey })
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'BROWSER_JOURNEY',
    failureFlagId: isFlag ? flagIds[0] : undefined,
    attempts: result.attempts.map((attempt): BindingObservation => {
      const observation = checkoutAttemptObservation(attempt)
      return {
        disposition: observation.disposition,
        reason: observation.reason,
        detail: { evaluator: CHECKOUT_ENTRY_EVALUATOR, stepCount: attempt.steps.length, videoUrl: attempt.videoUrl, httpStatus: attempt.outcome.httpStatus, finalUrl: attempt.finalUrl,
          ...(attempt.outcome.purchaseControlKey ? { purchaseControlKey: attempt.outcome.purchaseControlKey } : {}) },
      }
    }),
    conclusive: {
      disposition: verdict.disposition,
      reason: verdict.reason,
      detail: { evaluator: CHECKOUT_ENTRY_EVALUATOR, stepCount: result.steps.length, journeyReviewId: reviewId,
        checkoutDestinationKey: destinationKey, ...(result.purchaseControlKey ? { purchaseControlKey: result.purchaseControlKey } : {}) },
    },
  })
}
