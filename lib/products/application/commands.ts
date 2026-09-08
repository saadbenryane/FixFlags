import type { Clock } from '@/lib/time/clock'
import {
  materializeAttentionForAudit,
  reconcileImprovementVerification,
  recordFlagImprovementAttempt,
  recordOwnerFlagFeedbackDecision,
  recordRecommendedImprovements,
} from '@/lib/improvements/service'
import { setProjectWatch } from '@/lib/audit/project-watch'
import { recordFlagFeedback } from '@/lib/improvements/feedback'

export type ProductCommand =
  | {
      type: 'MATERIALIZE_ATTENTION'
      auditId: string
    }
  | ({ type: 'RECORD_FLAG_ACTION' } & Parameters<typeof recordFlagImprovementAttempt>[0])
  | ({ type: 'RECORD_OWNER_FEEDBACK' } & Parameters<typeof recordOwnerFlagFeedbackDecision>[0])
  | ({ type: 'RECORD_FLAG_FEEDBACK' } & Parameters<typeof recordFlagFeedback>[0])
  | ({ type: 'RECORD_RECOMMENDATIONS' } & Parameters<typeof recordRecommendedImprovements>[0])
  | ({ type: 'RECONCILE_UPDATE_REVIEW' } & Parameters<typeof reconcileImprovementVerification>[0])
  | ({ type: 'SET_WATCH' } & Parameters<typeof setProjectWatch>[0])

type CommandOf<T extends ProductCommand['type']> = Extract<ProductCommand, { type: T }>

export interface ProductCommandDependencies {
  clock?: Clock
}

export function executeProductCommand(
  command: CommandOf<'MATERIALIZE_ATTENTION'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof materializeAttentionForAudit>
export function executeProductCommand(
  command: CommandOf<'RECORD_FLAG_ACTION'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof recordFlagImprovementAttempt>
export function executeProductCommand(
  command: CommandOf<'RECORD_OWNER_FEEDBACK'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof recordOwnerFlagFeedbackDecision>
export function executeProductCommand(
  command: CommandOf<'RECORD_FLAG_FEEDBACK'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof recordFlagFeedback>
export function executeProductCommand(
  command: CommandOf<'RECORD_RECOMMENDATIONS'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof recordRecommendedImprovements>
export function executeProductCommand(
  command: CommandOf<'RECONCILE_UPDATE_REVIEW'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof reconcileImprovementVerification>
export function executeProductCommand(
  command: CommandOf<'SET_WATCH'>,
  dependencies?: ProductCommandDependencies
): ReturnType<typeof setProjectWatch>
export function executeProductCommand(
  command: ProductCommand,
  dependencies: ProductCommandDependencies = {}
) {
  switch (command.type) {
    case 'MATERIALIZE_ATTENTION':
      return materializeAttentionForAudit(command.auditId)
    case 'RECORD_FLAG_ACTION': {
      const { type, ...input } = command
      void type
      return dependencies.clock
        ? recordFlagImprovementAttempt(input, { clock: dependencies.clock })
        : recordFlagImprovementAttempt(input)
    }
    case 'RECORD_OWNER_FEEDBACK': {
      const { type, ...input } = command
      void type
      return dependencies.clock
        ? recordOwnerFlagFeedbackDecision(input, { clock: dependencies.clock })
        : recordOwnerFlagFeedbackDecision(input)
    }
    case 'RECORD_FLAG_FEEDBACK': {
      const { type, ...input } = command
      void type
      return recordFlagFeedback(input)
    }
    case 'RECORD_RECOMMENDATIONS': {
      const { type, ...input } = command
      void type
      return recordRecommendedImprovements(input)
    }
    case 'RECONCILE_UPDATE_REVIEW': {
      const { type, ...input } = command
      void type
      return dependencies.clock
        ? reconcileImprovementVerification(input, { clock: dependencies.clock })
        : reconcileImprovementVerification(input)
    }
    case 'SET_WATCH': {
      const { type, ...input } = command
      void type
      return dependencies.clock
        ? setProjectWatch(input, { clock: dependencies.clock })
        : setProjectWatch(input)
    }
  }
}
