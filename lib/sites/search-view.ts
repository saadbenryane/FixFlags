import { searchEvidence } from './search-evidence'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import type { BoardCardView } from './board-card'
import { siteCoverageIsStale } from './coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

/** One customer projection of persisted Search facts, shared by HTTP and MCP. */
export function applySearchCardEvidence(card: BoardCardView, executions: Array<{ targetKey: string; detail: unknown }>, inFlight: boolean, now = new Date()) {
  if (card.id !== 'search') return
  const evidence = searchEvidence(executions)
  if (!evidence) return
  const { receipts, complete, excluded, unfinished } = evidence
  card.incompleteReason = card.incompleteReason ?? (!inFlight && !complete
    ? unfinished.length ? C.unfinished(unfinished) : C.partial
    : null)
  // A confirmed problem stays visible even when other Search work is missing.
  if (card.openFlagCount > 0) return
  card.evidenced = evidence.evidenced
  card.state = card.state === 'healthy' && complete && !excluded && !card.incompleteReason ? 'healthy' : 'unknown'
  card.answer = excluded ? C.summary.excluded : complete ? C.summary.recorded : C.summary.partial
  card.status = excluded ? C.summary.observed : complete ? C.summary.checked : C.summary.unknown
  card.detail = excluded ? C.summary.restriction : complete ? C.summary.scope(receipts.length) : C.partial
  card.checkedAt = evidence.checkedAt
  if (receipts.some(receipt => siteCoverageIsStale(receipt.collectedAt, now))) {
    card.state = 'unknown'
    card.answer = SITE_BOARD_COPY.checkOutOfDate
    card.status = C.summary.unknown
    card.detail = SITE_BOARD_COPY.checkOutOfDateDetail
  }
  if (inFlight) card.activity = 'checking'
  const sources = receipts.flatMap(receipt => receipt.observations.filter(item => item.disposition !== 'unknown').map(item => C.sources[item.source]))
  card.sources = [...new Set([...card.sources, ...sources])]
}
