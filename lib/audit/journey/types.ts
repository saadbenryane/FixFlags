export type JourneyType =
  | 'first-visit'
  | 'pricing-evaluation'
  | 'signup'
  | 'contact-support'

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
}

export const JOURNEY_MAX_STEPS = 10
export const JOURNEY_TIMEOUT_MS = 60_000
