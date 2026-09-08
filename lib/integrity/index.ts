export { runPathProbe } from './run-path-probe'
export type { RunPathProbeOptions } from './run-path-probe'
export { classifyWalk, combineAttempts } from './classify'
export { isCartMutationPath } from '@/lib/audit/browser/journey-safety'
export type {
  PathHealth,
  PathProbeResult,
  PathReasonCode,
  PathStepEvidence,
  WalkOutcome,
} from './types'
