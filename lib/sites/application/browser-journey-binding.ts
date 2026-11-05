import { currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import { runGoalProbe, type BrowserJourneyConfig } from '@/lib/integrity/run-goal-probe'
import { classifyWalk, goalProbeReason } from '@/lib/integrity/classify'
import { recordBindingEvidence, type BindingObservation } from './binding-evidence'

/** Generic browser journey runner for any goal-driven outcome (login, signup, password reset, etc.) */
export async function runGenericBrowserJourneyBinding(input: {
  auditId: string
  runId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  config: BrowserJourneyConfig
}): Promise<void> {
  const result = await runGoalProbe({
    runId: `outcome-${input.runId}-${input.bindingKey}-g${currentExecutionOwnership()?.generation ?? 0}`,
    config: input.config,
  })
  const isFlag = result.health === 'RED' && result.confirmed
  const isClear = result.health === 'GREEN' && result.confirmed
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: 'BROWSER_JOURNEY',
    attempts: result.attempts.map((attempt): BindingObservation => {
      const classified = classifyWalk(attempt.outcome)
      return {
        disposition:
          classified.health === 'GREEN' ? 'SUCCEEDED' : classified.health === 'RED' ? 'FAILED' : 'BLOCKED',
        reason: goalProbeReason(classified, input.config.safety),
        detail: { stepCount: attempt.steps.length, videoUrl: attempt.videoUrl },
      }
    }),
    conclusive: {
      disposition: isFlag ? 'FAILED' : isClear ? 'SUCCEEDED' : 'BLOCKED',
      reason: result.reason,
      detail: { stepCount: result.steps.length },
    },
  })
}
