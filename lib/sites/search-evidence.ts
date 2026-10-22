import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { readRecordedSearchReceipt, type RecordedSearchExecution } from '@/lib/audit/search/contracts'
import { SEARCH_COPY as C } from '@/lib/marketing/copy/search'

/** Recorded local responsibilities define Search completeness. Provider evidence
 * enriches this scope without becoming a prerequisite for public checks. */
export function searchEvidence(executions: RecordedSearchExecution[]) {
  const localDefinitions = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
  const relevant = executions.filter(item => item.targetKey === 'module:search' || localDefinitions.some(definition => item.targetKey === 'module:search-' + definition.evaluator))
  if (!relevant.length) return null
  const unavailable: string[] = []
  const entries = relevant.flatMap(item => {
    const receipt = readRecordedSearchReceipt(item)
    if (!receipt) { unavailable.push(item.targetKey); return [] }
    return [{ targetKey: item.targetKey, receipt }]
  })
  const receipts = entries.map(item => item.receipt)
  const modulesByPage = new Map<string, Set<string>>()
  for (const entry of entries) {
    const modules = modulesByPage.get(entry.receipt.pageUrl) ?? new Set<string>()
    modules.add(entry.targetKey)
    modulesByPage.set(entry.receipt.pageUrl, modules)
  }
  const missing = [...modulesByPage.values()].flatMap(modules => modules.has('module:search') ? []
    : localDefinitions.filter(definition => !modules.has('module:search-' + definition.evaluator)))
  const complete = unavailable.length === 0 && missing.length === 0 && receipts.every(receipt => receipt.complete && !receipt.observations.some(item => item.disposition === 'unknown'))
  const unfinished = new Set(receipts.flatMap(receipt => receipt.observations
    .filter(item => item.disposition === 'unknown').map(item => C.groups[item.responsibility])))
  missing.forEach(definition => unfinished.add(C.groups[definition.responsibility]))
  unavailable.forEach(targetKey => {
    const definitions = targetKey === 'module:search' ? localDefinitions
      : localDefinitions.filter(definition => targetKey === 'module:search-' + definition.evaluator)
    definitions.forEach(definition => unfinished.add(C.groups[definition.responsibility]))
  })
  const excluded = receipts.some(receipt => receipt.observations.some(item =>
    item.reason === 'declared_indexing_exclusion' || item.reason === 'declared_crawl_restriction'))
  return { receipts, complete, excluded, unfinished: [...unfinished],
    evidenced: receipts.some(receipt => receipt.observations.some(item => item.disposition !== 'unknown')),
    checkedAt: receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? null }
}
