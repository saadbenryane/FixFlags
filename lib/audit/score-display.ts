import { gradeFromScore } from '@/lib/audit/scoring'

export type ScoreDisplayMode = 'numeric' | 'grade'

export interface ResolvedScoreDisplay {
  mode: ScoreDisplayMode
  primary: string
  secondary: string | null
  caption: string | null
  grade: string | null
  score: number | null
}

export function resolveScoreDisplay(input: {
  grade: string | null
  score: number | null
  isOverall?: boolean
}): ResolvedScoreDisplay {
  const { grade, score, isOverall = false } = input

  if (isOverall && score != null) {
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

  if (score != null) {
    const letterGrade = grade ?? gradeFromScore(score)
    return {
      mode: 'grade',
      primary: letterGrade,
      secondary: `${score}/100`,
      caption: null,
      grade: letterGrade,
      score,
    }
  }

  return {
    mode: 'grade',
    primary: grade ?? '-',
    secondary: null,
    caption: null,
    grade,
    score: null,
  }
}

export function formatScoreInline(
  score: number | null,
  grade: string | null,
  options?: { isOverall?: boolean }
): string {
  const resolved = resolveScoreDisplay({ grade, score, isOverall: options?.isOverall })

  if (resolved.mode === 'numeric' && resolved.score != null && resolved.grade) {
    return `${resolved.score}/100 · Grade ${resolved.grade}`
  }

  if (resolved.grade) {
    return `Grade ${resolved.grade}`
  }

  return '-'
}
