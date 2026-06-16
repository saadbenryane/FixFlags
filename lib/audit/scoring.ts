import type { RubricGrade, RubricName, RubricStatus } from '@prisma/client'

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
  if (value >= 90) return 'A'
  if (value >= 75) return 'B'
  if (value >= 60) return 'C'
  if (value >= 40) return 'D'
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
