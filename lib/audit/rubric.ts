import { RUBRIC_ORDER, type RubricName } from '@/lib/audit/constants'

/** Score-to-grade thresholds used by deterministic scoring and the AI judge. */
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
} as const

/** Max displayed/persisted score when a rubric has CRITICAL flags (status BLOCKED). */
export const BLOCKED_RUBRIC_SCORE_CEILING = GRADE_THRESHOLDS.B - 1

export const LAUNCH_CHECKLIST_IDS = [
  'https',
  'social-preview',
  'mobile-cta',
  'console-errors',
  'privacy-contact',
] as const

export type LaunchChecklistId = (typeof LAUNCH_CHECKLIST_IDS)[number]

/** Rubrics the judge must always return (one entry each). */
export const REQUIRED_JUDGE_RUBRICS = RUBRIC_ORDER

/** Criteria injected into the judge prompt for each rubric. */
export const RUBRIC_JUDGE_CRITERIA: Record<RubricName, readonly string[]> = {
  MESSAGE: [
    'Headline and subhead are specific to this product, not generic',
    'The hero says what the product does and who it is for',
    'Benefits and outcomes are clear before feature lists',
    'CTA copy is specific, not vague ("Get started" without context)',
    'Social proof, trust signals, and pricing confidence feel credible',
    'Copy hierarchy is scannable; claims are specific, not inflated',
  ],
  EXPERIENCE: [
    'Primary CTA visible above the fold on desktop and mobile screenshots',
    'Layout, buttons, forms, and flows work without confusion',
    'Mobile tap targets, viewport, and CTA visibility on 375px screens',
    'Keyboard use, contrast, labels, and accessibility basics',
    'Core Web Vitals, load speed, and visual polish',
    'No broken interactions, console errors, or layout shift issues',
  ],
  REACH: [
    'Title, description, og:image, favicon, and share preview tags',
    'Indexability, structured data, and heading hierarchy',
    'Privacy policy and contact links are easy to find',
    'Analytics and conversion events appear configured where expected',
    'Public links and metadata explain the product when shared',
  ],
}

export function formatRubricForJudgePrompt(): string {
  return RUBRIC_ORDER.map((rubric) => {
    const bullets = RUBRIC_JUDGE_CRITERIA[rubric].map((c) => `  - ${c}`).join('\n')
    return `${rubric}:\n${bullets}`
  }).join('\n\n')
}

// ─── Rubric status computation ──────────────────────────────────────────────

export type RubricStatus = 'PASS' | 'NEEDS_ATTENTION' | 'BLOCKED'

export interface RubricInput {
  name: string
  grade: string | null
  score: number | null
  flags?: Array<{ severity: string }>
}

export interface RubricSource {
  name: string
  grade: string | null
  score?: number | null
  flags?: Array<{ severity: string }>
}

export function buildRubricInput(
  rubrics: RubricSource[],
  flatFlags?: Array<{ severity: string; rubric?: string }>
): RubricInput[] {
  const flagsByRubric = new Map<string, Array<{ severity: string }>>()

  if (flatFlags) {
    for (const flag of flatFlags) {
      if (!flag.rubric) continue
      const list = flagsByRubric.get(flag.rubric) ?? []
      list.push({ severity: flag.severity })
      flagsByRubric.set(flag.rubric, list)
    }
  }

  return rubrics.map((rubric) => ({
    name: rubric.name,
    grade: rubric.grade,
    score: rubric.score ?? null,
    flags: rubric.flags ?? flagsByRubric.get(rubric.name) ?? [],
  }))
}

export function computeRubricsFromRows(
  rubrics: RubricSource[],
  flatFlags?: Array<{ severity: string; rubric?: string }>
): RubricComputed[] {
  return computeAllRubricStatuses(buildRubricInput(rubrics, flatFlags))
}

export function computeShareStatusFromRubrics(
  rubrics: RubricSource[],
  flatFlags?: Array<{ severity: string; rubric?: string }>
): ShareStatus {
  return computeShareStatus(computeRubricsFromRows(rubrics, flatFlags), flatFlags)
}

export interface RubricComputed {
  name: RubricName
  status: RubricStatus
  flagCount: number
  criticalCount: number
  importantCount: number
  /** Numeric score (0-100) derived from flags. */
  score?: number
  /** Letter grade (A/B/C/D/F) derived from score. */
  grade?: string
}

export type ShareStatus = 'good_to_share' | 'fix_before_sharing'

export function computeRubricStatus(rubric: RubricInput): RubricStatus {
  let hasBlocker = false
  let hasAttention = false

  if (rubric.grade === 'F') hasBlocker = true
  else if (rubric.grade === null || rubric.grade === 'D' || rubric.grade === 'C') {
    hasAttention = true
  }

  for (const flag of rubric.flags ?? []) {
    if (flag.severity === 'CRITICAL') hasBlocker = true
    else if (flag.severity === 'IMPORTANT') hasAttention = true
  }

  if (hasBlocker) return 'BLOCKED'
  if (hasAttention) return 'NEEDS_ATTENTION'
  return 'PASS'
}

export function computeAllRubricStatuses(rubrics: RubricInput[]): RubricComputed[] {
  const byName = new Map(rubrics.map((r) => [r.name, r]))

  return RUBRIC_ORDER.map((name) => {
    const rubric = byName.get(name) ?? {
      name,
      grade: null,
      score: null,
      flags: [],
    }
    const flags = rubric.flags ?? []
    return {
      name,
      status: computeRubricStatus(rubric),
      flagCount: flags.length,
      criticalCount: flags.filter((f) => f.severity === 'CRITICAL').length,
      importantCount: flags.filter((f) => f.severity === 'IMPORTANT').length,
    }
  })
}

export function computeShareStatus(
  rubrics: RubricComputed[],
  flatFlags?: Array<{ severity: string }>
): ShareStatus {
  const criticalFromRubrics = rubrics.some((r) => r.criticalCount > 0)
  const criticalFromFlags = (flatFlags ?? []).some((f) => f.severity === 'CRITICAL')
  if (criticalFromRubrics || criticalFromFlags) return 'fix_before_sharing'
  return 'good_to_share'
}
