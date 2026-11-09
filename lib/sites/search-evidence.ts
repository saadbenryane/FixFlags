import { isLocalSearchTarget, SEARCH_LOCAL_MODULES } from '@/lib/audit/search/definitions'
import { classifyRecordedSearchReceipt, type RecordedSearchExecution, type SearchReceipt } from '@/lib/audit/search/contracts'
import { hasUncoveredSearchObservations } from '@/lib/audit/search/completeness'
import type { PageObservationScope } from './page-coverage'

/** Recorded local responsibilities define Search completeness. Provider evidence
 * enriches this scope without becoming a prerequisite for public checks. */
export function searchEvidence(executions: RecordedSearchExecution[], scope?: PageObservationScope) {
  const local = executions.filter(item => item.status !== 'NOT_APPLICABLE' && isLocalSearchTarget(item.targetKey))
  if (!local.length) return null
  const expected = scope && { auditId: scope.auditId, pages: new Set(scope.pages) }
  const entries: Array<{ targetKey: string; receipt: SearchReceipt }> = []
  let unavailable = false
  for (const item of local) {
    const result = classifyRecordedSearchReceipt(item, expected)
    if (result.state === 'recorded') {
      if (result.receipt.observations.length) entries.push({ targetKey: item.targetKey, receipt: result.receipt })
      if (!result.receipt.observations.length || result.rejectedCheckIds.length) unavailable = true
    } else if (!expected || result.state !== 'out_of_scope') unavailable = true
  }
  const receipts = entries.map(item => item.receipt)
  const modulesByPage = new Map<string, Set<string>>()
  for (const entry of entries) {
    const scope = JSON.stringify([entry.receipt.auditId, entry.receipt.pageUrl])
    const modules = modulesByPage.get(scope) ?? new Set<string>()
    modules.add(entry.targetKey)
    modulesByPage.set(scope, modules)
  }
  const missing = [...modulesByPage.values()].some(modules => !modules.has('module:search') &&
    SEARCH_LOCAL_MODULES.some(target => !modules.has(target)))
  const observedPages = new Set(receipts.filter(receipt => receipt.observations.some(item => item.disposition !== 'unknown')).map(receipt => receipt.pageUrl))
  const receiptOpen = hasUncoveredSearchObservations(receipts) || receipts.some(receipt =>
    !receipt.complete && !receipt.observations.some(item => item.disposition === 'unknown'))
  const missingPages = scope?.pages.some(page => !observedPages.has(page))
  const complete = !unavailable && !missing && !receiptOpen && !missingPages
  const excluded = receipts.some(receipt => receipt.observations.some(item =>
    item.reason === 'declared_indexing_exclusion' || item.reason === 'declared_crawl_restriction'))
  return { receipts, complete, excluded,
    evidenced: observedPages.size > 0,
    checkedAt: receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? null }
}
