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

export function statusFromScore(score: number): AreaStatus {
  const grade = gradeFromScore(score)
  if (grade === 'A') return 'EXCELLENT'
  if (grade === 'B') return 'GOOD'
  if (grade === 'C') return 'NEEDS_WORK'
  return 'CRITICAL'
}

export function calculateOverallScore(
  scores: Partial<Record<AreaName, number | null>>
): number | null {
  for (const area of Object.keys(AREA_WEIGHTS) as AreaName[]) {
    if (scores[area] === null || scores[area] === undefined) return null
  }

  return clampScore(
    (Object.keys(AREA_WEIGHTS) as AreaName[]).reduce(
      (total, area) => total + clampScore(scores[area]!) * AREA_WEIGHTS[area],
      0
    )
  )
}
