import { RUBRIC_ORDER, type RubricName } from '../constants'
import { computeRubricScores } from '../checks'
import type { TriageOutput } from '../judge-triage-schema'
import type { PageRun } from './types'

/**
 * Average each rubric's deterministic score across pages, preferring the
 * deterministic score and falling back to the triage score.
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
          page.mobile,
          {
            pageSpeedAvailable: {
              desktop: Boolean(page.desktop),
              mobile: Boolean(page.mobile),
            },
            failedModules: page.failedModules,
          }
        )[rubricName]
        return (
          deterministic ??
          page.triage?.output.rubrics.find((item) => item.name === rubricName)?.score ??
          null
        )
      })
      .filter((score): score is number => score !== null)
    output[rubricName] =
      values.length > 0 && values.length === pageRuns.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null
  }
  return output
}

/**
 * Merge triage output from pages that ran triage (primary page only on critical-path).
 */
export function buildCombinedTriageOutput(pageRuns: PageRun[]): TriageOutput {
  const triagePages = pageRuns.filter((page) => page.triage)
  const primaryTriage = pageRuns[0]?.triage
  if (!primaryTriage) {
    throw new Error('Cannot combine triage output without a primary triage result')
  }
  const combined = { ...primaryTriage.output, rubrics: [...primaryTriage.output.rubrics] }
  combined.newFlags = triagePages.flatMap((page) => page.triage?.output.newFlags ?? [])
  if (triagePages.length <= 1) {
    return combined
  }
  combined.rubrics = combined.rubrics.map((rubric) => {
    const pageRubrics = triagePages
      .map((page) => page.triage?.output.rubrics.find((item) => item.name === rubric.name))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
    const scores = pageRubrics
      .map((item) => item.score)
      .filter((score): score is number => score !== null)
    return {
      ...rubric,
      score:
        scores.length === triagePages.length
          ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)
          : null,
      assessmentState:
        scores.length === triagePages.length ? ('ASSESSED' as const) : ('PARTIAL' as const),
      confidence:
        pageRubrics.reduce((sum, item) => sum + item.confidence, 0) / pageRubrics.length,
    }
  })
  return combined
}
