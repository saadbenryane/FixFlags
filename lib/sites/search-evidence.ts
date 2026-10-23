import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { searchReceiptSchema } from '@/lib/audit/search/contracts'

/** A missing alternate source stays on its own observation. It does not erase
 * the same check once another source recorded a result. */
const ALTERNATE_SOURCE_UNAVAILABLE = new Set(['document_truncated', 'required_evidence_unavailable', 'capture_unavailable'])

function coveredAlternateGap(observations: Array<{ checkId: string; source: string; disposition: string; reason: string }>, item: { checkId: string; source: string; disposition: string; reason: string }) {
  return item.disposition === 'unknown' && ALTERNATE_SOURCE_UNAVAILABLE.has(item.reason) && observations.some(other =>
    other.checkId === item.checkId && other.source !== item.source && other.disposition !== 'unknown')
}

/** Recorded local responsibilities define Search completeness. Provider evidence
 * enriches this scope without becoming a prerequisite for public checks. */
export function searchEvidence(executions: Array<{ targetKey: string; detail?: unknown }>) {
  const localDefinitions = SEARCH_DEFINITIONS.filter(item => !['google', 'cross-page'].includes(item.evaluator))
  const entries = executions.filter(item => item.targetKey === 'module:search' || localDefinitions.some(definition => item.targetKey === 'module:search-' + definition.evaluator)).flatMap(item => {
    const parsed = searchReceiptSchema.safeParse(item.detail)
    return parsed.success ? [{ targetKey: item.targetKey, receipt: parsed.data }] : []
  })
  const receipts = entries.map(item => item.receipt)
  if (!receipts.length) return null
  const modulesByPage = new Map<string, Set<string>>()
  for (const entry of entries) {
    const modules = modulesByPage.get(entry.receipt.pageUrl) ?? new Set<string>()
    modules.add(entry.targetKey)
    modulesByPage.set(entry.receipt.pageUrl, modules)
  }
  const missing = [...modulesByPage.values()].flatMap(modules => modules.has('module:search') ? []
    : localDefinitions.filter(definition => !modules.has('module:search-' + definition.evaluator)))
  const observations = receipts.flatMap(receipt => receipt.observations)
  const blocking = observations.filter(item => item.disposition === 'unknown' && !coveredAlternateGap(observations, item))
  const receiptOpen = receipts.some(receipt => {
    if (receipt.complete) return false
    const unknowns = receipt.observations.filter(item => item.disposition === 'unknown')
    return !unknowns.length || unknowns.some(item => !coveredAlternateGap(observations, item))
  })
  const complete = missing.length === 0 && !receiptOpen && blocking.length === 0
  const excluded = receipts.some(receipt => receipt.observations.some(item =>
    item.reason === 'declared_indexing_exclusion' || item.reason === 'declared_crawl_restriction'))
  return { receipts, complete, excluded,
    evidenced: receipts.some(receipt => receipt.observations.some(item => item.disposition !== 'unknown')),
    checkedAt: receipts.map(receipt => receipt.collectedAt).sort().at(-1) ?? null }
}
