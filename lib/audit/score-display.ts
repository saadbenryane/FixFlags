import type { AreaName } from '@prisma/client'
import { gradeFromScore } from '@/lib/audit/scoring'

export const OBJECTIVE_AREAS = [
  'PERFORMANCE',
  'ACCESSIBILITY',
  'SEO',
  'MOBILE',
] as const satisfies readonly AreaName[]

export type ObjectiveAreaName = (typeof OBJECTIVE_AREAS)[number]

export function isObjectiveArea(name: string): boolean {
  return (OBJECTIVE_AREAS as readonly string[]).includes(name)
}

export type ScoreDisplayMode = 'numeric' | 'grade'

export interface ResolvedScoreDisplay {
  mode: ScoreDisplayMode
  /** "78" or "B" */
  primary: string
  /** "Grade B" for numeric mode */
  secondary: string | null
  /** "/ 100" for numeric mode, or "Experience grade" for grade mode */
  caption: string | null
  grade: string | null
  score: number | null
}

export function resolveScoreDisplay(input: {
  areaName?: string | null
  grade: string | null
  score: number | null
}): ResolvedScoreDisplay {
  const { areaName, grade, score } = input
  const isOverall = !areaName
  const useNumeric = isOverall || isObjectiveArea(areaName)

  if (useNumeric && score != null) {
    const letterGrade = grade ?? gradeFromScore(score)
    return {
      mode: 'numeric',
      primary: String(score),
      secondary: `Grade ${letterGrade}`,
      caption: '/ 100',
      grade: letterGrade,
      score,
    }
  }

  if (useNumeric && grade != null) {
    return {
      mode: 'numeric',
      primary: grade,
      secondary: null,
      caption: null,
      grade,
      score: null,
    }
  }

  return {
    mode: 'grade',
    primary: grade ?? '-',
    secondary: null,
    caption: 'Experience grade',
    grade,
    score: null,
  }
}

export function formatScoreInline(
  score: number | null,
  grade: string | null,
  options?: { areaName?: string | null }
): string {
  const resolved = resolveScoreDisplay({
    areaName: options?.areaName,
    grade,
    score,
  })

  if (resolved.mode === 'numeric' && resolved.score != null && resolved.grade) {
    return `${resolved.score}/100 · Grade ${resolved.grade}`
  }

  if (resolved.grade) {
    return `Grade ${resolved.grade}`
  }

  return '—'
}

export function areaScoreForDisplay(area: {
  name: string
  score: number | null
}): number | null {
  return isObjectiveArea(area.name) ? area.score : null
}
