import { computeRubricScores } from '../checks'
import type { TriageOutput } from '../judge-triage-schema'
import type { PageEvidence } from './types'
import type { PageSpeedResult } from '../pagespeed'
import { hasCurrentPageSpeedLabMeasurement } from '../performance-measurement'
import { projectDeterministicFlags } from '../flag-projection'
import type { DeterministicFlag } from '../flag-types'
import type { RubricName } from '../constants'

function lowestPagespeed(results: Array<PageSpeedResult | null>): PageSpeedResult | null {
  const scored = results.filter((result): result is PageSpeedResult => result != null && typeof result.score === 'number')
  if (scored.length === 0) return results.find(Boolean) ?? null
  return scored.reduce((worst, current) =>
    (current.score ?? 100) < (worst.score ?? 100) ? current : worst
  )
}

/** Retain raw PageSpeed data on the page while qualifying its use as current lab evidence. */
export function currentPageSpeedLab(page: Pick<PageEvidence, 'url' | 'desktop' | 'mobile'>, device: PageSpeedResult['strategy']) {
  const result = page[device]
  return result?.strategy === device && hasCurrentPageSpeedLabMeasurement(result, page.url) &&
    [result.score, result.lcp, result.cls, result.fcp, result.tbt].some(value => typeof value === 'number') ? result : null
}

/**
 * Product score from Flags, not page averages.
 * A severe issue on /checkout is not diluted by healthy marketing pages.
 */
export function productScoresFromFlags(
  pageRuns: PageEvidence[], recordedFlags?: DeterministicFlag[]
): Partial<Record<RubricName, number | null>> {
  if (pageRuns.length === 0) {
    return { MESSAGE: null, EXPERIENCE: null, REACH: null }
  }
  const collapsed = collapsedPageFlags(pageRuns, recordedFlags)
  const failedModules = [...new Set(pageRuns.flatMap((page) => page.failedModules))]
  const desktop = pageRuns.map(page => currentPageSpeedLab(page, 'desktop'))
  const mobile = pageRuns.map(page => currentPageSpeedLab(page, 'mobile'))
  return computeRubricScores(collapsed, lowestPagespeed(desktop), lowestPagespeed(mobile), {
    pageSpeedAvailable: {
      desktop: desktop.every(Boolean),
      mobile: mobile.every(Boolean),
    },
    failedModules,
  })
}

/** True when every fully reviewed page has desktop and mobile PageSpeed. */
export function reviewedPagesHaveFullPageSpeed(pageRuns: PageEvidence[]): boolean {
  return pageRuns.length > 0 && pageRuns.every(page => currentPageSpeedLab(page, 'desktop') && currentPageSpeedLab(page, 'mobile'))
}

/**
 * Merge triage output from reviewed pages. Rubric numbers come from Flags later.
 */
export function buildCombinedTriageOutput(pageRuns: PageEvidence[]): TriageOutput {
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

export function collapsedPageFlags(pageRuns: PageEvidence[], recordedFlags?: DeterministicFlag[]): DeterministicFlag[] {
  return projectDeterministicFlags(recordedFlags ?? pageRuns.flatMap((page) => page.flags))
}
