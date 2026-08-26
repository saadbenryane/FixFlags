import { computeRubricScores } from '../checks'
import type { TriageOutput } from '../judge-triage-schema'
import type { PageRun } from './types'
import type { PageSpeedResult } from '../pagespeed'
import { collapseFlagsWithAffectedPaths } from '../flag-identity'
import type { DeterministicFlag } from '../flag-types'
import type { RubricName } from '../constants'

function lowestPagespeed(results: Array<PageSpeedResult | null>): PageSpeedResult | null {
  const scored = results.filter((result): result is PageSpeedResult => result != null && typeof result.score === 'number')
  if (scored.length === 0) return results.find(Boolean) ?? null
  return scored.reduce((worst, current) =>
    (current.score ?? 100) < (worst.score ?? 100) ? current : worst
  )
}

/**
 * Product score from Flags, not page averages.
 * A severe issue on /checkout is not diluted by healthy marketing pages.
 */
export function productScoresFromFlags(
  pageRuns: PageRun[]
): Partial<Record<RubricName, number | null>> {
  const collapsed = collapseFlagsWithAffectedPaths(pageRuns.flatMap((page) => page.flags))
  const failedModules = [...new Set(pageRuns.flatMap((page) => page.failedModules))]
  const desktop = lowestPagespeed(pageRuns.map((page) => page.desktop))
  const mobile = lowestPagespeed(pageRuns.map((page) => page.mobile))
  return computeRubricScores(collapsed, desktop, mobile, {
    pageSpeedAvailable: {
      desktop: pageRuns.some((page) => Boolean(page.desktop)),
      mobile: pageRuns.some((page) => Boolean(page.mobile)),
    },
    failedModules,
  })
}

/** @deprecated Use productScoresFromFlags. Kept for existing test imports. */
export function averageScores(
  pageRuns: PageRun[]
): Partial<Record<RubricName, number | null>> {
  return productScoresFromFlags(pageRuns)
}

/**
 * Merge triage output from reviewed pages. Rubric numbers come from Flags later.
 */
export function buildCombinedTriageOutput(pageRuns: PageRun[]): TriageOutput {
  const triagePages = pageRuns.filter((page) => page.triage)
  const primaryTriage = pageRuns.find((page) => page.triage)?.triage
  if (!primaryTriage) {
    throw new Error('Cannot combine triage output without a reviewed-page triage result')
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
    return {
      ...rubric,
      score: null,
      assessmentState: 'PARTIAL' as const,
      confidence:
        pageRubrics.reduce((sum, item) => sum + item.confidence, 0) / Math.max(1, pageRubrics.length),
    }
  })
  return combined
}

export function collapsedPageFlags(pageRuns: PageRun[]): DeterministicFlag[] {
  return collapseFlagsWithAffectedPaths(pageRuns.flatMap((page) => page.flags))
}
