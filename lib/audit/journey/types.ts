export type JourneyType =
  | 'first-visit'
  | 'pricing-evaluation'
  | 'signup'
  | 'contact-support'
  | 'multi-step-funnel'

export interface JourneyFindingDraft {
  checkId: string
  stepNumber: number
  url: string
  rubric: 'MESSAGE' | 'EXPERIENCE' | 'REACH'
  severity: 'CRITICAL' | 'IMPORTANT' | 'POLISH'
  impactTag:
    | 'CONVERSION'
    | 'REVENUE'
    | 'TRUST'
    | 'MEASUREMENT'
    | 'SHARING'
    | 'SEO'
    | 'ACCESSIBILITY'
    | 'CLARITY'
    | 'AUTHORITY'
    | 'FRICTION'
    | 'EMOTION'
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  screenshotUrl?: string | null
  accessibilityEvidence?: string | null
  confidence?: number
  /** Classification of the finding for multi-step funnel analysis. */
  findingType?: 'friction' | 'broken-promise' | 'accessibility-barrier' | 'dead-end' | 'confusion' | null
}

export interface JourneyStepDraft {
  stepNumber: number
  actionType: string
  actionDetail: Record<string, unknown>
  url: string
  screenshotBeforeUrl?: string | null
  screenshotAfterUrl?: string | null
  accessibilityTree: string
  consoleErrors?: string[]
  networkErrors?: string[]
  loadTimeMs?: number | null
  confidence?: number
  reasoning?: string | null
  /** a11y tree reference for the element acted on (ref attribute). */
  elementRef?: string | null
  /** Human-readable description of the element acted on. */
  elementDescription?: string | null
  /** Whether the outcome matched the planned expectation. */
  outcomeMatch?: boolean | null
  /** Why the outcome matched or didn't. */
  outcomeDetail?: string | null
}

export interface JourneyRunResult {
  journeyType: JourneyType
  startUrl: string
  status: 'COMPLETED' | 'ABANDONED' | 'FAILED'
  goalAchieved: boolean
  blockedReason?: string | null
  abandonedReason?: string | null
  steps: JourneyStepDraft[]
  findings: JourneyFindingDraft[]
  durationMs: number
  formProbe?: { url: string; method: string; status: number } | null
  actionTimeline?: Array<{
    t: number
    kind: string
    label: string
    url?: string
    status?: number | string
    screenshot?: string | null
  }>
  /** Token usage from the journey planner (if AI planner was used). */
  plannerUsage?: { inputTokens: number; outputTokens: number; model: string } | null
  /** Serialized AI plan for audit trail and debugging. */
  planJson?: string | null
}

export const JOURNEY_MAX_STEPS = 10
export const JOURNEY_TIMEOUT_MS = 60_000
/** Maximum times a URL can appear before the journey detects a loop. */
export const JOURNEY_LOOP_THRESHOLD = 3
/** Per-step timeout in milliseconds. */
export const JOURNEY_STEP_TIMEOUT_MS = 15_000
