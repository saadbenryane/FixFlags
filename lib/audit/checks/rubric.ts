import type { DeterministicFlag } from './index'
import type { PageSpeedResult } from '../pagespeed'

export const SCAN_STEP_FAILURE_PENALTY = 25

const MESSAGE_MODULES = new Set(['content', 'slop', 'messaging-clarity', 'conversion-friction', 'trust-psychology', 'visual-hierarchy'])
const REACH_MODULES = new Set(['metadata', 'og-image', 'seo', 'trust', 'trust-psychology'])

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

  let experience: number
  if (perfScores.length > 0) {
    let score = Math.round(perfScores.reduce((a, b) => a + b, 0) / perfScores.length)
    for (const f of experienceFindings) {
      score -= rubricPenalty(f.severity)
    }
    experience = clampRubricScore(score)
  } else if (experienceFindings.length > 0) {
    experience = scoreFromFindings(experienceFindings)
  } else if (pageSpeedUnavailable || failedModules.includes('performance')) {
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
  }
}

function scoreFromFindings(findings: DeterministicFlag[]): number {
  let score = 100
  for (const f of findings) {
    score -= rubricPenalty(f.severity)
  }
  return clampRubricScore(score)
}
