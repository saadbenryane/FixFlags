export type PathHealth = 'GREEN' | 'RED' | 'UNKNOWN'

export type PathReasonCode =
  | 'checkout_reached'
  | 'goal_reached'
  | 'http_error'
  | 'soft_unavailable'
  | 'buy_control_unclickable'
  | 'add_to_cart_noop'
  | 'checkout_error'
  | 'no_buy_control'
  | 'bot_wall'
  | 'password_gate'
  | 'timeout'
  | 'flaky'
  | 'probe_error'
  | 'safety_boundary'

export type PathStepLabel = 'landing' | 'variant' | 'add_to_cart' | 'cart' | 'checkout' | 'failure' | `step_${number}`

export interface PathStepEvidence {
  label: PathStepLabel
  url: string
  screenshotUrl: string | null
  destinationUrl?: string
}

export interface WalkOutcome {
  reachedCheckout: boolean
  httpStatus: number | null
  buyControlFound: boolean
  buyControlClicked: boolean
  cartUpdated: boolean
  checkoutErrorVisible: boolean
  botWall: boolean
  passwordGate: boolean
  timedOut: boolean
  pageUnavailable: boolean
  failedStep: PathStepLabel | null
  safetyRefused?: boolean
}

export interface PathProbeAttempt {
  outcome: WalkOutcome
  steps: PathStepEvidence[]
  videoUrl: string | null
  gifUrl: string | null
  finalUrl: string
}

export interface PathProbeResult {
  health: PathHealth
  reason: PathReasonCode
  confirmed: boolean
  attempts: PathProbeAttempt[]
  steps: PathStepEvidence[]
  videoUrl: string | null
  gifUrl: string | null
  failedStep: PathStepLabel | null
  finalUrl: string
}
