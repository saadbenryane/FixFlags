import { searchReceiptSchema } from '@/lib/audit/search/contracts'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'
import type { BoardCardView } from './board-card'
import { siteCoverageIsStale } from './coverage'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'

/** One customer projection of persisted Search facts, shared by HTTP and MCP. */
export function applySearchCardEvidence(card: BoardCardView, executions: Array<{ targetKey: string; detail: unknown }>, inFlight: boolean, now = new Date()) {
  if (card.id !== 'search') return
  const receipts = executions.filter(item => item.targetKey === 'module:search').flatMap(item => {
    const parsed = searchReceiptSchema.safeParse(item.detail)
    return parsed.success ? [parsed.data] : []
  })
  if (!receipts.length || card.openFlagCount > 0) return
  const complete = receipts.every(receipt => receipt.complete)
  const excluded = receipts.some(receipt => receipt.observations.some(item =>
    item.reason === 'declared_indexing_exclusion' || item.reason === 'declared_crawl_restriction'))
  card.evidenced = receipts.some(receipt => receipt.observations.some(item => item.disposition !== 'unknown'))
  card.state = complete && !excluded ? 'healthy' : 'unknown'
  card.answer = excluded ? C.summary.excluded : complete ? C.summary.recorded : C.summary.partial
  card.status = excluded ? C.summary.observed : complete ? C.summary.checked : C.summary.unknown
  card.detail = excluded ? C.summary.restriction : complete ? C.summary.scope(receipts.length) : C.partial
  card.checkedAt = receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? null
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
