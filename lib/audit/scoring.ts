import type { AreaGrade, AreaName, AreaStatus } from '@prisma/client'

export const AREA_WEIGHTS: Record<AreaName, number> = {
  PERFORMANCE: 0.15,
  ACCESSIBILITY: 0.15,
  SEO: 0.15,
  CONVERSION: 0.2,
  TRUST: 0.15,
  CONTENT: 0.1,
  MOBILE: 0.1,
}

/** Experience areas scored A–F only in UI; mapped to numeric for overall score. */
export const SUBJECTIVE_AREAS: readonly AreaName[] = ['CONVERSION', 'TRUST', 'CONTENT']

const GRADE_NUMERIC: Record<AreaGrade, number> = {
  A: 95,
  B: 82,
  C: 67,
  D: 50,
  F: 25,
}

export function isSubjectiveArea(area: AreaName): boolean {
  return SUBJECTIVE_AREAS.includes(area)
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function gradeFromScore(score: number): AreaGrade {
  const value = clampScore(score)
  if (value >= 90) return 'A'
  if (value >= 75) return 'B'
  if (value >= 60) return 'C'
  if (value >= 40) return 'D'
  return 'F'
}

export function numericFromGrade(grade: AreaGrade): number {
  return GRADE_NUMERIC[grade]
}

export function statusFromScore(score: number): AreaStatus {
  const grade = gradeFromScore(score)
  if (grade === 'A') return 'EXCELLENT'
  if (grade === 'B') return 'GOOD'
  if (grade === 'C') return 'NEEDS_WORK'
  return 'CRITICAL'
}

export function statusFromGrade(grade: AreaGrade): AreaStatus {
  return statusFromScore(numericFromGrade(grade))
}

export function areaNumericValue(input: {
  score: number | null
  grade: AreaGrade | null
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
  scores: Partial<Record<AreaName, number | null>>,
  grades?: Partial<Record<AreaName, AreaGrade | null>>
): number | null {
  const values: number[] = []

  for (const area of Object.keys(AREA_WEIGHTS) as AreaName[]) {
    const numeric = areaNumericValue({
      score: scores[area] ?? null,
      grade: grades?.[area] ?? null,
    })
    if (numeric === null) return null
    values.push(numeric)
  }

  return clampScore(
    (Object.keys(AREA_WEIGHTS) as AreaName[]).reduce(
      (total, area) =>
        total +
        areaNumericValue({
          score: scores[area] ?? null,
          grade: grades?.[area] ?? null,
        })! *
          AREA_WEIGHTS[area],
      0
    )
  )
}
