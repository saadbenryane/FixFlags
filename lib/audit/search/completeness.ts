import type { SearchObservation, SearchReceipt } from './contracts'

const ALTERNATE_SOURCE_UNAVAILABLE = new Set(['document_truncated', 'required_evidence_unavailable', 'capture_unavailable'])
type RecordedObservations = Pick<SearchReceipt, 'auditId' | 'observations'>

/** Alternate sources can cover the same recorded responsibility. Keep the
 * individual unknown observation for source-specific repair and history. */
export function hasUncoveredSearchObservations(receipts: readonly RecordedObservations[]): boolean {
  if (!receipts.length || receipts.some(receipt => !receipt.observations.length)) return true
  if (!receipts.some(receipt => receipt.observations.some(item => item.disposition === 'unknown'))) return false
  const scopeKey = (receipt: RecordedObservations, item: SearchObservation) =>
    JSON.stringify([receipt.auditId, item.pageUrl, item.checkId, item.checkVersion])
  const sourcesByScope = new Map<string, Set<SearchObservation['source']>>()
  for (const receipt of receipts) for (const item of receipt.observations) {
    if (item.disposition === 'unknown') continue
    const key = scopeKey(receipt, item)
    const sources = sourcesByScope.get(key) ?? new Set<SearchObservation['source']>()
    sources.add(item.source)
    sourcesByScope.set(key, sources)
  }
  return receipts.some(receipt => receipt.observations.some(item => item.disposition === 'unknown' &&
    (!ALTERNATE_SOURCE_UNAVAILABLE.has(item.reason) ||
      ![...sourcesByScope.get(scopeKey(receipt, item)) ?? []].some(source => source !== item.source))))
}
