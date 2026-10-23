import { searchEvidence } from './search-evidence'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import type { BoardCardView } from './board-card'
import { siteCoverageIsStale } from './evidence-freshness'
import { SITE_BOARD_COPY, SITE_PRESENTATION_COPY } from '@/lib/marketing/copy/terminology'

/** One customer projection of persisted Search facts, shared by HTTP and MCP. */
export function applySearchCardEvidence(card: BoardCardView, executions: Array<{ targetKey: string; detail: unknown }>, inFlight: boolean, now = new Date(), coverageMaxAgeMs?: number) {
  if (card.id !== 'search') return
  const evidence = searchEvidence(executions)
  if (!evidence) return
  const { receipts, complete, excluded } = evidence
  card.incompleteReason = card.incompleteReason ?? (!inFlight && !complete
    ? SITE_BOARD_COPY.cardCheckIncomplete
    : null)
  // A confirmed problem stays visible even when other Search work is missing.
  if (card.openFlagCount > 0) return
  card.evidenced = evidence.evidenced
  card.checkedAt = evidence.checkedAt
  const stale = receipts.some(receipt => siteCoverageIsStale(receipt.collectedAt, now, coverageMaxAgeMs))
  const clear = !inFlight && card.state === 'healthy' && complete && !excluded && !card.incompleteReason && !stale
  if (stale) {
    card.state = 'unknown'
    card.answer = SITE_BOARD_COPY.checkOutOfDate
    card.status = C.summary.unknown
    card.detail = SITE_BOARD_COPY.checkOutOfDateDetail
  } else if (excluded) {
    card.state = 'unknown'
    card.answer = C.summary.excluded
    card.status = C.summary.observed
    card.detail = C.summary.restriction
  } else if (inFlight && complete && !card.incompleteReason) {
    card.state = card.state === 'healthy' ? 'healthy' : 'unknown'
    card.answer = SITE_BOARD_COPY.checking
    card.status = SITE_BOARD_COPY.checking
    card.detail = null
  } else if (clear) {
    card.state = 'healthy'
    card.answer = SITE_PRESENTATION_COPY.flags(0)
    card.status = SITE_PRESENTATION_COPY.flags(0)
    card.detail = null
  } else if (complete && card.incompleteReason) {
    card.state = 'unknown'
    card.answer = card.incompleteReason
    card.status = C.summary.unknown
    card.detail = null
  } else {
    card.state = 'unknown'
    card.answer = C.summary.partial
    card.status = C.summary.unknown
    card.detail = C.partial
  }
  if (inFlight) card.activity = 'checking'
  const sources = receipts.flatMap(receipt => receipt.observations.filter(item => item.disposition !== 'unknown').map(item => C.sources[item.source]))
  card.sources = [...new Set([...card.sources, ...sources])]
}
