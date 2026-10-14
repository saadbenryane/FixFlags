import type { SiteHomeView } from './site-home'
import { type SiteCardArea } from './card-areas'
import { siteTrendChecks } from './monitoring-history'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { outcomeFreshnessDisclosure } from './outcome-state'
import { BOARD_PREVIEW_COPY as B } from '@/lib/marketing/copy/board-preview'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { UPTIME_COPY as U } from '@/lib/marketing/copy/uptime'
import type { ToolItem, BoardSummaryItem } from './board-types'

export function outcomeCardFreshness(outcome: SiteHomeView['outcomes'][number]): string {
  const when = outcome.lastVerifiedAt ? formatEvidenceTimestamp(outcome.lastVerifiedAt) : null
  if (!when) return SITE_ACTION_COPY.outcome.noVerification
  if (outcome.state === 'COULD_NOT_VERIFY') return SITE_ACTION_COPY.outcome.lastAttempted(when)
  if (outcome.state === 'STALE') {
    return `${SITE_ACTION_COPY.outcome.lastVerified(when)}. ${outcomeFreshnessDisclosure(outcome.state, outcome.staleAfterMinutes)}`
  }
  return SITE_ACTION_COPY.outcome.lastVerified(when)
}

export function projectSiteBoard(view: SiteHomeView, siteId: string, _signedIn: boolean, checking: boolean, selectedCard: SiteCardArea | null) {
  const selected = selectedCard ? view.cards.find((card) => card.id === selectedCard) ?? null : null
  const selectedFlags = selected ? view.flags.filter((flag) => flag.area === selected.id) : []
  const findingPages = new Set(selectedFlags.map((flag) => flag.pageUrl).filter(Boolean)).size
  const selectedRecommendations = selected ? (view.recommendations ?? []).filter((item) => item.area === selected.id) : []
  const cardsById = new Map(view.cards.map((card) => [card.id, card]))
  const visibleCategories = view.presentation.categories.filter((category) => {
    const card = cardsById.get(category.id)
    if (!card || category.id === 'uptime' && view.actions.ownership === 'owner') return false
    return true
  })
  const confirmedOutcomes = view.outcomes.filter((outcome) => outcome.kind !== 'GENERIC' && outcome.bindings.some(binding => binding.required)).sort((left, right) => {
    const rank = { FLAG: 0, COULD_NOT_VERIFY: 1, STALE: 2, CLEAR: 3 }
    return rank[left.state] - rank[right.state]
  })
  const pagesNeedingAttention = new Set(view.flags.flatMap(flag => flag.affectedPaths.length ? flag.affectedPaths : [flag.pageUrl ?? view.site.url])).size
  const summaryItems: BoardSummaryItem[] = [
    { value: view.presentation.flags.count, label: checking ? SITE_ACTION_COPY.execution.flagsSoFar : B.flags(view.presentation.flags.count).replace(/^\d+ /, ''), state: view.presentation.flags.count > 0 ? 'attention' as const : 'unknown' as const },
  ]
  const recordedPageCount = view.counts.recordedPages
  if (!checking && recordedPageCount > 0) summaryItems.push({ id: 'pages', value: recordedPageCount, label: view.counts.checkedPages === recordedPageCount ? B.checkedPages(recordedPageCount) : B.recordedPages(recordedPageCount),
    detail: [view.counts.checkedPages < recordedPageCount ? B.completedPages(view.counts.checkedPages) : null, pagesNeedingAttention ? B.pagesNeedAttention(pagesNeedingAttention) : null, view.counts.savedPages > recordedPageCount ? B.savedPages(view.counts.savedPages) : null].filter(Boolean).join(' · ') || undefined, state: pagesNeedingAttention ? 'attention' : 'unknown' })
  const technologies: ToolItem[] = (view.technology?.items ?? []).map(item => ({
    name: item.name,
    status: view.technology?.status === 'complete' ? 'Detected' : 'Detected in partial check',
    state: view.technology?.status === 'complete' ? 'healthy' : 'attention',
  }))
  const monitoringPoints = siteTrendChecks(view.monitoringTrend).map(item => ({
    label: new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.checkedAt)),
    flagCount: item.status === 'FAILED' || item.completionState === 'PARTIAL' || !item.evidenceAt ? null : item.flagCount,
  }))
  const monitoringEvents = (view.monitoringHistory ?? []).toReversed().map(item => ({
    id: item.id ?? item.checkedAt,
    title: item.afterFix ? B.history.afterFix : item.status === 'FAILED' || item.completionState === 'PARTIAL' ? B.incomplete : B.complete,
    detail: item.scope ? [item.trigger === 'SCHEDULED' ? B.history.scheduled : item.trigger === 'MANUAL' ? B.history.manual : item.trigger === 'OTHER' ? B.history.other : null,
      item.scope === 'SITE' ? B.history.site : item.scope === 'CATEGORY' ? item.targetLabel ?? B.history.unknown : item.scope === 'OUTCOMES' ? B.history.outcomes : item.scope === 'DIAGNOSTIC' ? B.history.diagnostic : B.history.unknown,
      item.targetLabel].filter(Boolean).join(' · ') : undefined,
    resultLabel: item.result === 'COULD_NOT_VERIFY' ? B.history.uncertain : item.result === 'FLAG' ? B.history.flagged : item.result === 'CLEAR' ? item.afterFix ? B.history.recovered : B.history.clear : undefined,
    time: formatEvidenceTimestamp(item.checkedAt) ?? item.checkedAt,
    dateTime: item.checkedAt,
    state: item.status === 'FAILED' || item.completionState === 'PARTIAL' || item.result === 'COULD_NOT_VERIFY' || item.scope !== 'SITE' && item.result == null ? 'unknown' as const : item.flagCount > 0 || item.result === 'FLAG' ? 'attention' as const : 'healthy' as const,
    flagCount: item.scope && item.scope !== 'SITE' ? undefined : item.flagCount,
    flags: (item.flags ?? []).map(flag => ({ ...flag, href: `/sites/${siteId}/flags/${flag.id}` })),
  }))
  const uptimeEvents = (view.uptimeEvents ?? []).flatMap(incident => [
    { id: `uptime-down-${incident.id}`, title: U.eventDown, detail: incident.targetUrl, time: formatEvidenceTimestamp(incident.confirmedAt) ?? incident.confirmedAt,
      dateTime: incident.confirmedAt, state: 'attention' as const, evidenceHref: `/sites/${siteId}#category-uptime`, evidenceLabel: U.details },
    ...(incident.recoveredAt ? [{ id: `uptime-recovered-${incident.id}`, title: U.eventRecovered, detail: incident.targetUrl,
      time: formatEvidenceTimestamp(incident.recoveredAt) ?? incident.recoveredAt, dateTime: incident.recoveredAt, state: 'healthy' as const,
      evidenceHref: `/sites/${siteId}#category-uptime`, evidenceLabel: U.details }] : []),
  ])
  const timelineEvents = [...monitoringEvents, ...uptimeEvents].sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))
  return { selected, selectedFlags, findingPages, selectedRecommendations, cardsById, visibleCategories,
    confirmedOutcomes, pagesNeedingAttention, summaryItems, technologies, monitoringPoints, timelineEvents }
}
