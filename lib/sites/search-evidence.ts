import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { readRecordedSearchReceipt, type RecordedSearchExecution, type SearchObservation, type SearchReceipt } from '@/lib/audit/search/contracts'

/** A missing alternate source stays on its own observation. It does not erase
 * the same check once another source recorded a result. */
const ALTERNATE_SOURCE_UNAVAILABLE = new Set(['document_truncated', 'required_evidence_unavailable', 'capture_unavailable'])

/** Recorded local responsibilities define Search completeness. Provider evidence
 * enriches this scope without becoming a prerequisite for public checks. */
export function searchEvidence(executions: RecordedSearchExecution[]) {
  const localDefinitions = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
  const entries = executions.filter(item => item.targetKey === 'module:search' || localDefinitions.some(definition => item.targetKey === 'module:search-' + definition.evaluator)).flatMap(item => {
    const receipt = readRecordedSearchReceipt(item)
    return receipt ? [{ targetKey: item.targetKey, receipt }] : []
  })
  const receipts = entries.map(item => item.receipt)
  if (!receipts.length) return null
  const modulesByPage = new Map<string, Set<string>>()
  for (const entry of entries) {
    const scope = JSON.stringify([entry.receipt.auditId, entry.receipt.pageUrl])
    const modules = modulesByPage.get(scope) ?? new Set<string>()
    modules.add(entry.targetKey)
    modulesByPage.set(scope, modules)
  }
  const missing = [...modulesByPage.values()].flatMap(modules => modules.has('module:search') ? []
    : localDefinitions.filter(definition => !modules.has('module:search-' + definition.evaluator)))
  // Alternate sources can cover the same recorded responsibility, never a
  // different page, execution or detector. Index once rather than comparing
  // every unavailable observation with the entire multi-page inventory.
  const scopeKey = (receipt: SearchReceipt, item: SearchObservation) => JSON.stringify([receipt.auditId, item.pageUrl, item.checkId, item.checkVersion])
  const sourcesByScope = new Map<string, Set<SearchObservation['source']>>()
  for (const receipt of receipts) for (const item of receipt.observations) {
    if (item.disposition === 'unknown') continue
    const key = scopeKey(receipt, item), sources = sourcesByScope.get(key) ?? new Set<SearchObservation['source']>()
    sources.add(item.source); sourcesByScope.set(key, sources)
  }
  const coveredAlternateGap = (receipt: SearchReceipt, item: SearchObservation) =>
    ALTERNATE_SOURCE_UNAVAILABLE.has(item.reason) &&
    [...sourcesByScope.get(scopeKey(receipt, item)) ?? []].some(source => source !== item.source)
  const receiptOpen = receipts.some(receipt => {
    const unknowns = receipt.observations.filter(item => item.disposition === 'unknown')
    return !receipt.complete && !unknowns.length || unknowns.some(item => !coveredAlternateGap(receipt, item))
  })
  const complete = missing.length === 0 && !receiptOpen
  const excluded = receipts.some(receipt => receipt.observations.some(item =>
    item.reason === 'declared_indexing_exclusion' || item.reason === 'declared_crawl_restriction'))
  return { receipts, complete, excluded,
    evidenced: receipts.some(receipt => receipt.observations.some(item => item.disposition !== 'unknown')),
    checkedAt: receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? null }
}
