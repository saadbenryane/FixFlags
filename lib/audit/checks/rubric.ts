import type { DeterministicFlag } from './index'
import type { PageSpeedResult } from '../pagespeed'

export const SCAN_STEP_FAILURE_PENALTY = 25

// Kept in sync with each check module's `rubric:` field assignments (see
// lib/audit/checks/*.ts) so a crashed module always applies an uncertainty
// penalty to every rubric it could have produced findings for, not just some.
const MESSAGE_MODULES = new Set([
  'content',
  'slop',
  'trust',
  'cta-focus',
  'messaging-clarity',
  'conversion-friction',
  'trust-psychology',
  'visual-hierarchy',
  'mobile-ux-quality',
])
const REACH_MODULES = new Set([
  'metadata',
  'og-image',
  'seo',
  'trust',
  'measurement',
  'security',
  'security-headers',
  'trust-psychology',
])
const EXPERIENCE_MODULES = new Set([
  'metadata',
  'performance',
  'accessibility',
  'seo',
  'mobile',
  'content',
  'layout',
  'interaction',
  'auth-checkout',
  'conversion-friction',
  'trust-psychology',
  'visual-hierarchy',
  'mobile-ux-quality',
  'visual-polish',
])

export interface RubricScoreContext {
  pageSpeedAvailable?: { desktop: boolean; mobile: boolean }
  failedModules?: string[]
}

export function computeRubricScores(
  findings: DeterministicFlag[],
  desktop: PageSpeedResult | null,
  mobile: PageSpeedResult | null,
  context: RubricScoreContext = {}
): Record<'MESSAGE' | 'EXPERIENCE' | 'REACH', number> {
  const messageFindings = findings.filter((f) => f.rubric === 'MESSAGE')
  const experienceFindings = findings.filter((f) => f.rubric === 'EXPERIENCE')
  const reachFindings = findings.filter((f) => f.rubric === 'REACH')
  const failedModules = context.failedModules ?? []

  const pageSpeedDesktop =
    context.pageSpeedAvailable?.desktop ??
    (desktop != null && desktop.score != null)
  const pageSpeedMobile =
    context.pageSpeedAvailable?.mobile ?? (mobile != null && mobile.score != null)
  const pageSpeedUnavailable = !pageSpeedDesktop && !pageSpeedMobile

  const perfScores = [desktop?.score, mobile?.score].filter(
    (s): s is number => typeof s === 'number' && !Number.isNaN(s)
  )

  // A crashed check module (e.g. mobile-ux-quality, interaction, trust-psychology)
  // means its potential EXPERIENCE findings never had a chance to run - apply the
  // same uncertainty penalty PageSpeed-unavailable already gets, even when the raw
  // PageSpeed score itself is fine, so a module failure never silently scores 100.
  const failedExperienceModules = failedModules.some((name) => EXPERIENCE_MODULES.has(name))

  let experience: number
  if (perfScores.length > 0) {
    let score = Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
    const counts = { CRITICAL: 0, IMPORTANT: 0, POLISH: 0 } as Record<string, number>
    for (const f of experienceFindings) {
      counts[f.severity]++
    }
    score -= counts.CRITICAL * Math.log(1 + counts.CRITICAL) * 10
    score -= counts.IMPORTANT * Math.log(1 + counts.IMPORTANT) * 6
    score -= counts.POLISH * Math.log(1 + counts.POLISH) * 2
    if (failedExperienceModules) score -= SCAN_STEP_FAILURE_PENALTY
    experience = clampRubricScore(Math.round(score))
  } else if (experienceFindings.length > 0) {
    const penalty = failedExperienceModules ? SCAN_STEP_FAILURE_PENALTY : 0
    experience = clampRubricScore(scoreFromFindings(experienceFindings) - penalty)
  } else if (pageSpeedUnavailable || failedExperienceModules) {
    experience = penalizedBaseline(experienceFindings)
  } else {
    experience = 100
  }

  const message = scoreRubricDimension(messageFindings, MESSAGE_MODULES, failedModules)
  const reach = scoreRubricDimension(reachFindings, REACH_MODULES, failedModules)

  return { MESSAGE: message, EXPERIENCE: experience, REACH: reach }
}

function scoreRubricDimension(
  findings: DeterministicFlag[],
  moduleSet: Set<string>,
  failedModules: string[]
): number {
  if (findings.length > 0) return scoreFromFindings(findings)
  if (failedModules.some((name) => moduleSet.has(name))) {
    return penalizedBaseline(findings)
  }
  return 100
}

function penalizedBaseline(findings: DeterministicFlag[]): number {
  let score = 100 - SCAN_STEP_FAILURE_PENALTY
  for (const f of findings) {
    score -= rubricPenalty(f.severity)
  }
  return clampRubricScore(score)
}

function clampRubricScore(score: number): number {
  return Math.max(0, Math.min(100, score))
}

function rubricPenalty(severity: DeterministicFlag['severity']): number {
  switch (severity) {
    case 'CRITICAL':
      return 25
    case 'IMPORTANT':
      return 15
    case 'POLISH':
      return 5
    default:
      return 0
  }
}

function scoreFromFindings(findings: DeterministicFlag[]): number {
  let score = 100
  const counts = { CRITICAL: 0, IMPORTANT: 0, POLISH: 0 } as Record<string, number>
  for (const f of findings) {
    counts[f.severity]++
  }
  // Logarithmic decay: first flag has most impact, diminishing returns for additional flags
  score -= counts.CRITICAL * Math.log(1 + counts.CRITICAL) * 10
  score -= counts.IMPORTANT * Math.log(1 + counts.IMPORTANT) * 6
  score -= counts.POLISH * Math.log(1 + counts.POLISH) * 2
  return clampRubricScore(Math.round(score))
}
