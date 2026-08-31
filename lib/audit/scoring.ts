import type { RubricGrade, RubricName, RubricStatus } from '@prisma/client'
import { BLOCKED_RUBRIC_SCORE_CEILING, GRADE_THRESHOLDS } from './rubric'

/** Issue-weighted diagnostic. Not a conversion or revenue prediction. */
export const SCORE_FORMULA_VERSION = 1 as const

export const SCORE_FORMULA_EXPLANATION =
  'An issue-weighted summary of this Review. It is not a prediction of conversion or revenue.'

export const RUBRIC_WEIGHTS: Record<RubricName, number> = {
  MESSAGE: 0.35,
  EXPERIENCE: 0.4,
  REACH: 0.25,
}

const GRADE_NUMERIC: Record<RubricGrade, number> = {
  A: 95,
  B: 82,
  C: 67,
  D: 50,
  F: 25,
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function gradeFromScore(score: number): RubricGrade {
  const value = clampScore(score)
  if (value >= GRADE_THRESHOLDS.A) return 'A'
  if (value >= GRADE_THRESHOLDS.B) return 'B'
  if (value >= GRADE_THRESHOLDS.C) return 'C'
  if (value >= GRADE_THRESHOLDS.D) return 'D'
  return 'F'
}

export function numericFromGrade(grade: RubricGrade): number {
  return GRADE_NUMERIC[grade]
}

export function statusFromScore(score: number): RubricStatus {
  const grade = gradeFromScore(score)
  if (grade === 'A') return 'EXCELLENT'
  if (grade === 'B') return 'GOOD'
  if (grade === 'C') return 'NEEDS_WORK'
  return 'CRITICAL'
}

export function statusFromGrade(grade: RubricGrade): RubricStatus {
  return statusFromScore(numericFromGrade(grade))
}

export function rubricNumericValue(input: {
  score: number | null
  grade: RubricGrade | null
}): number | null {
  if (input.score !== null && input.score !== undefined) {
    return clampScore(input.score)
  }
  if (input.grade) {
    return numericFromGrade(input.grade)
  }
  return null
}

export function calculateOverallScore(
  scores: Partial<Record<RubricName, number | null>>,
  grades?: Partial<Record<RubricName, RubricGrade | null>>
): number | null {
  const rubrics = Object.keys(RUBRIC_WEIGHTS) as RubricName[]

  for (const rubric of rubrics) {
    const numeric = rubricNumericValue({
      score: scores[rubric] ?? null,
      grade: grades?.[rubric] ?? null,
    })
    if (numeric === null) return null
  }

  return clampScore(
    rubrics.reduce(
      (total, rubric) =>
        total +
        rubricNumericValue({
          score: scores[rubric] ?? null,
          grade: grades?.[rubric] ?? null,
        })! *
          RUBRIC_WEIGHTS[rubric],
      0
    )
  )
}

function rubricScoreFromSeverities(severities: string[]): number {
  const counts = { CRITICAL: 0, IMPORTANT: 0, POLISH: 0 }
  for (const severity of severities) {
    if (severity === 'CRITICAL' || severity === 'IMPORTANT' || severity === 'POLISH') {
      counts[severity] += 1
    }
  }
  let score = 100
  score -= counts.CRITICAL * Math.log(1 + counts.CRITICAL) * 10
  score -= counts.IMPORTANT * Math.log(1 + counts.IMPORTANT) * 6
  score -= counts.POLISH * Math.log(1 + counts.POLISH) * 2
  const clamped = clampScore(Math.round(score))
  if (counts.CRITICAL > 0) return Math.min(clamped, BLOCKED_RUBRIC_SCORE_CEILING)
  return clamped
}

/**
 * Same issue-weighted diagnostic over a Flag subset. Used for like-for-like
 * Update review progress on identities from last time, never as a replacement
 * for the full Review score.
 */
export function comparableScoreFromFlags(
  flags: Array<{ rubric: string; severity: string }>
): number {
  const byRubric: Record<RubricName, string[]> = {
    MESSAGE: [],
    EXPERIENCE: [],
    REACH: [],
  }
  for (const flag of flags) {
    const name = flag.rubric.toUpperCase() as RubricName
    if (name in byRubric) byRubric[name].push(flag.severity)
  }
  return calculateOverallScore({
    MESSAGE: rubricScoreFromSeverities(byRubric.MESSAGE),
    EXPERIENCE: rubricScoreFromSeverities(byRubric.EXPERIENCE),
    REACH: rubricScoreFromSeverities(byRubric.REACH),
  }) as number
}
