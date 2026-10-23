import { isAuditFinished } from './coverage'
import { watchBoardState, watchIsCovered } from './watch-state'
import { categoryPresentation, flagCountLabel, freshnessLabel, monitoringPresentation, pageCoverageLabel,
  pagesCardPresentation, resultPresentation, runPresentation, type SitePresentation } from './presentation'
import type { SiteHomeView } from './site-home'
import type { siteCardHealth } from './site-health'
import type { resolveLatestAudit } from './application/site-execution'
import type { CoverageFact } from './coverage'
import type { SiteCapture } from './captures'
import type { PageCoverage } from './page-coverage'

type Audit = Awaited<ReturnType<typeof resolveLatestAudit>>
export function projectHomePresentation(input: {
  siteId: string; site: SiteHomeView['site']; cards: SiteHomeView['cards']; flags: SiteHomeView['flags'];
  health: ReturnType<typeof siteCardHealth>; coverage: CoverageFact[];
  pageCoverage: PageCoverage; capture?: SiteCapture; audit: Audit; prior: Audit; finished: boolean; now: Date;
}) {
  const { siteId, site, cards, flags, health, coverage, pageCoverage, capture, audit, prior, finished, now } = input
  const siteCardState = health.state
  const watchState = watchBoardState({
    interval: site.watchInterval,
    nextRunAt: site.watchNextRunAt,
    lastError: site.watchLastError,
    consecutiveFailures: site.watchConsecutiveFailures,
    now,
  })
  const watching = watchIsCovered(watchState)
  const completedAt = (isAuditFinished(audit?.status) ? audit : prior)?.completedAt?.toISOString() ?? null
  const { pagesReached, pagesExpected } = pageCoverage
  const evidenceFacts = coverage.filter((fact) => fact.evidenced)
  const stale = evidenceFacts.length > 0 && evidenceFacts.every((fact) => fact.stale === true)
  const result = resultPresentation({
    auditStatus: audit?.status ?? null,
    healthState: siteCardState,
    flagCount: flags.length,
    stale,
    hasCurrentEvidence: finished && evidenceFacts.some((fact) => !fact.stale),
    assessmentResult: health.assessment.result,
    uptime: health.uptime,
  })
  const monitoring = monitoringPresentation(watchState, site.watchInterval, site.watchEveryMinutes)
  const projectedRun = runPresentation({
    auditId: audit?.id ?? null,
    auditStatus: audit?.status ?? null,
    startedAt: audit?.startedAt ?? null,
    failureCode: audit?.failureCode ?? null,
    reportCompleteness: audit?.reportCompleteness ?? null,
    failedModules: audit?.failedModules,
    evidenceCoverage: audit?.evidenceCoverage,
  })
  const presentation: SitePresentation = {
    identity: {
      siteId,
      name: site.name,
      host: site.canonicalHost,
      preview: capture ? {
        url: capture.url,
        pageUrl: capture.pageUrl,
        viewport: capture.viewport,
        recordedAt: capture.recordedAt,
      } : null,
    },
    result,
    monitoring,
    coverage: {
      pagesReached,
      pagesExpected,
      label: pageCoverageLabel(pagesReached, pagesExpected),
      complete: pageCoverage.complete,
    },
    freshness: {
      checkedAt: completedAt,
      stale,
      label: freshnessLabel(completedAt, now),
    },
    flags: {
      count: flags.length,
      label: flagCountLabel(flags.length),
      fixFirstCount: flags.filter((flag) => flag.priorityBand === 'fix_first').length,
    },
    run: projectedRun,
    categories: [],
  }
  const pagesCategory = pagesCardPresentation(presentation, flags.filter(flag => flag.area === 'site'))
  presentation.categories = cards.map((card) => categoryPresentation({
    id: card.id,
    name: card.name,
    state: card.id === 'site' ? pagesCategory.state : card.state,
    answer: card.id === 'site' ? presentation.coverage.label : card.answer,
    status: card.id === 'site' ? pagesCategory.status : card.status,
    flagCount: card.openFlagCount,
    fixFirstCount: flags.filter((flag) => flag.area === card.id && flag.priorityBand === 'fix_first').length,
    checkedAt: card.checkedAt,
    coverageLimitation: card.incompleteReason,
    siteId,
    now,
  })).sort((left, right) => left.rank - right.rank)

  return { presentation, watchState, watching, monitoring }
}
