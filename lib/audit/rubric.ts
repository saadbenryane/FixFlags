import { AREA_ORDER } from '@/lib/audit/constants'

/** Score-to-grade thresholds used by deterministic scoring and the AI judge. */
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 75,
  C: 60,
  D: 40,
} as const

export const LAUNCH_CHECKLIST_IDS = [
  'https',
  'social-preview',
  'mobile-cta',
  'console-errors',
  'privacy-contact',
] as const

export type LaunchChecklistId = (typeof LAUNCH_CHECKLIST_IDS)[number]

/** Areas the judge must always return (one entry each). */
export const REQUIRED_JUDGE_AREAS = AREA_ORDER

/** Subjective areas scored A-F from screenshots; no PageSpeed numeric score. */
export const SUBJECTIVE_JUDGE_AREAS = ['CONVERSION', 'TRUST', 'CONTENT'] as const

/** Criteria injected into the judge prompt for subjective areas. */
export const SUBJECTIVE_AREA_RUBRIC: Record<
  (typeof SUBJECTIVE_JUDGE_AREAS)[number],
  readonly string[]
> = {
  CONVERSION: [
    'Primary CTA visible above the fold on desktop and mobile screenshots',
    'One clear primary action (not three equal competing buttons)',
    'Headline states an outcome, not a category label',
    'Signup or demo friction is low for the page job',
  ],
  TRUST: [
    'Privacy policy and contact info are easy to find',
    'Social proof, logos, or credibility markers where expected',
    'Visual design looks intentional, not broken or placeholder',
    'Security or payment trust cues on pricing or signup surfaces',
  ],
  CONTENT: [
    'Headline and subhead are specific to this product, not generic',
    'Features are explained as benefits where it matters',
    'Copy is scannable with clear hierarchy',
    'Page copy matches the inferred page job and page type',
  ],
}

/** Objective area nuance hints for the judge when reconciling with deterministic findings. */
export const OBJECTIVE_AREA_RUBRIC: Record<string, readonly string[]> = {
  PERFORMANCE: [
    'Grade from Core Web Vitals and Lighthouse opportunities in the evidence',
    'A >=90, B >=75, C >=60, D >=40, F below 40',
  ],
  ACCESSIBILITY: [
    'A = zero violations, B = 1-2 minor, C = missing alts/labels/contrast, D/F = critical failures',
    'Include color contrast and keyboard bypass issues from deterministic findings',
  ],
  SEO: [
    'A = title, description, og tags, structured data, single H1',
    'B = 1-2 missing tags, C = missing description or multiple H1, D/F = no title or noindex',
  ],
  MOBILE: [
    'Grade from mobile PageSpeed, tap targets, viewport, and mobile screenshot UX',
    'CTA must be visible without scrolling on a 375px-wide viewport',
  ],
}

export function formatRubricForJudgePrompt(): string {
  const subjective = SUBJECTIVE_JUDGE_AREAS.map((area) => {
    const bullets = SUBJECTIVE_AREA_RUBRIC[area].map((c) => `  - ${c}`).join('\n')
    return `${area}:\n${bullets}`
  }).join('\n\n')

  const objective = Object.entries(OBJECTIVE_AREA_RUBRIC)
    .map(([area, criteria]) => {
      const bullets = criteria.map((c) => `  - ${c}`).join('\n')
      return `${area}:\n${bullets}`
    })
    .join('\n\n')

  return `Subjective area rubric (grade from screenshots + page text):\n${subjective}\n\nObjective area rubric (align with deterministic evidence):\n${objective}`
}
