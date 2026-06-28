import { RUBRIC_ORDER, type RubricName } from '../constants'
import { computeRubricScores } from '../checks'
import type { JudgeOutput } from '../judge-schema'
import type { PageRun } from './types'

/**
 * Average each rubric's deterministic score across pages, preferring the
 * deterministic score and falling back to the judge's score. A rubric is only
 * scored when every page produced a value for it.
 */
export function averageScores(
  pageRuns: PageRun[]
): Partial<Record<RubricName, number | null>> {
  const output: Partial<Record<RubricName, number | null>> = {}
  for (const rubricName of RUBRIC_ORDER) {
    const values = pageRuns
      .map((page) => {
        const deterministic = computeRubricScores(
          page.flags,
          page.desktop,
          page.mobile
        )[rubricName]
        return (
          deterministic ??
          page.judge?.output.rubrics.find((item) => item.name === rubricName)?.score ??
          null
        )
      })
      .filter((score): score is number => score !== null)
    output[rubricName] =
      values.length === pageRuns.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null
  }
  return output
}

/**
 * Merge every page's judge output into the primary page's output: concatenate
 * new flags and enrichments, and average each rubric across pages. Mutates and
 * returns the primary judge output (callers persist it directly).
 */
export function buildCombinedJudgeOutput(pageRuns: PageRun[]): JudgeOutput {
  const primaryJudge = pageRuns[0]?.judge
  if (!primaryJudge) {
    throw new Error('Cannot combine judge output without a primary judge result')
  }
  const combined = primaryJudge.output
  combined.newFlags = pageRuns.flatMap((page) => page.judge?.output.newFlags ?? [])
  combined.enrichments = pageRuns.flatMap((page) => page.judge?.output.enrichments ?? [])
  combined.rubrics = combined.rubrics.map((rubric) => {
    const pageRubrics = pageRuns
      .map((page) => page.judge?.output.rubrics.find((item) => item.name === rubric.name))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    const scores = pageRubrics
      .map((item) => item.score)
      .filter((score): score is number => score !== null)
    return {
      ...rubric,
      score:
        scores.length === pageRuns.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null,
      assessmentState:
        scores.length === pageRuns.length ? ('ASSESSED' as const) : ('PARTIAL' as const),
      confidence:
        pageRubrics.reduce((sum, item) => sum + item.confidence, 0) / pageRubrics.length,
    }
  })
  return combined
}
