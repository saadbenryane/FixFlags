import { PAGES_CARD_AREA } from './card-areas'
import { checkAssertionsForVersion, CHECK_MODULES } from '@/lib/audit/checks/definitions'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import type { CheckAssertion, CheckObservationReason } from '@/lib/audit/checks/assertion'
import { classifyRecordedSearchReceipt } from '@/lib/audit/search/contracts'
import { SEARCH_DEFINITIONS } from '@/lib/audit/search/definitions'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { matchesRecordedVerifierTask } from '@/lib/improvements/verifier-scope'
import type { SiteCheckResult } from './check-result-contract'

export const SEARCH_RESULT_TARGET_KEYS = [
  'module:search',
  ...SEARCH_DEFINITIONS.map(definition => 'module:search-' + definition.evaluator),
  'module:search-google-index',
  'module:search-google-performance',
]

/** Ledger completion and readable observation evidence answer different questions. */
export function readModuleCheckResult(auditId: string, receipt: {
  targetKey: string; status: string; pageUrl: string | null; detail: unknown; taskId?: string | null;
}) {
  const detail = readCheckReceipt(receipt.detail)
  const taskMismatch = !detail.legacy && detail.execution && !matchesRecordedVerifierTask(receipt.taskId, detail.execution.taskId)
  const scopeMismatch = !detail.legacy && (receipt.targetKey !== 'module:' + detail.module || detail.pageUrl !== receipt.pageUrl ||
    Boolean(taskMismatch || detail.execution && detail.execution.auditId !== auditId))
  const status: SiteCheckResult['status'] = taskMismatch ? 'unknown' : receipt.status === 'FAILED' ? 'failed'
    : receipt.status === 'NOT_APPLICABLE' ? 'not_applicable'
    : detail.unavailable || scopeMismatch || 'complete' in detail && detail.complete === false ? 'unknown'
    : 'applicable' in detail && detail.applicable === false ? 'not_applicable'
    : detail.passed === false ? 'findings' : 'completed'
  return { detail, scopeMismatch, status }
}

export function projectCheckResults(auditId: string, receipts: Array<{
  id: string; targetKey: string; status: string; pageUrl: string | null;
  updatedAt: Date; detail: unknown;
  source?: string; taskId?: string | null;
}>, historical = false): SiteCheckResult[] {
  return receipts.flatMap<SiteCheckResult>(receipt => {
    if (!receipt.targetKey.startsWith('module:')) return []
    const moduleName = receipt.targetKey.slice('module:'.length)
    if (SEARCH_RESULT_TARGET_KEYS.includes(receipt.targetKey)) {
      if (!['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(receipt.status)) return []
      const scoped = classifyRecordedSearchReceipt({ targetKey: receipt.targetKey, detail: receipt.detail, pageUrl: receipt.pageUrl, auditId })
      const search = scoped.state === 'recorded' ? scoped.receipt : null
      const observations = search?.observations ?? []
      // A terminal provider attempt can record why evidence was unavailable.
      const visible = receipt.status === 'COMPLETED' ? observations
        : observations.filter(item => item.disposition === 'unknown' || item.disposition === 'not_applicable')
      const recorded = visible.map(item => ({
        id: `${receipt.id}:${item.id}`, auditId, area: 'search' as const, name: item.name, kind: 'assertion' as const,
        status: item.disposition === 'failed' ? 'findings' as const : item.disposition,
        pageUrl: item.pageUrl, checkedAt: item.collectedAt, historical, limitation: item.limitation, source: item.source,
        evidenceReference: { auditId, executionId: receipt.id, pageUrl: item.pageUrl },
        observation: item.observed, expected: item.expected, search: item,
      } satisfies SiteCheckResult))
      const missingScope = receipt.status === 'COMPLETED' && scoped.state === 'recorded' &&
        (scoped.rejectedCheckIds.length > 0 || !scoped.receipt.complete && !visible.some(item => item.disposition === 'unknown'))
      if (recorded.length && !missingScope) return recorded
      const modules = SITE_ACTION_COPY.execution.modules as Readonly<Record<string, string>>
      return [...recorded, { id: receipt.id, auditId, area: 'search', name: modules[moduleName] ?? CHECK_MODULES.search.name, kind: 'execution',
        status: receipt.status === 'FAILED' ? 'failed' : receipt.status === 'NOT_APPLICABLE' ? 'not_applicable' : 'unknown',
        pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical,
        limitation: receipt.status === 'NOT_APPLICABLE' ? 'This check had no applicable evidence in this scope.'
          : recorded.length ? 'Only part of this Search check was recorded. The remaining scope is unknown.'
          : 'No completed Search observation was recorded for this check in this scope.',
        source: receipt.source ?? 'SEARCH', evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl } }]
    }
    const descriptor = CHECK_MODULES[moduleName]
    if (!descriptor) return [{ id: receipt.id, auditId, area: PAGES_CARD_AREA,
      name: receipt.targetKey.slice('module:'.length), kind: 'execution', status: 'unknown',
      pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical: true,
      limitation: SITE_ACTION_COPY.historicalCheck,
      source: receipt.source ?? 'HISTORICAL', evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl } }]
    if (!['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(receipt.status)) return []
    const { detail, scopeMismatch, status } = readModuleCheckResult(auditId, receipt)
    const execution = !scopeMismatch && !detail.legacy ? detail.execution : undefined
    const definitions = checkAssertionsForVersion(moduleName, execution?.checkVersion)
    const provenance = {
      source: execution?.source ?? receipt.source ?? 'DETERMINISTIC',
      evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl },
    }
    const assertions = receipt.status === 'COMPLETED' && !scopeMismatch
      ? detail.assertions.flatMap((assertion, index) => {
          const repeated = detail.assertions.some((other, otherIndex) => otherIndex !== index && other.key === assertion.key && other.context === assertion.context)
          return [{ id: `${receipt.id}:${assertion.key}${assertion.context ? ':' + assertion.context : ''}${repeated ? ':' + index : ''}`, auditId, ...provenance,
            name: assertion.name, area: definitions[assertion.key]?.area ?? descriptor.area,
            kind: 'assertion' as const, status: assertion.complete === false ? 'unknown' as const : assertion.disposition === 'observed' ? 'observed' as const : assertion.passed ? 'passed' as const : 'findings' as const,
            reason: assertion.reason ?? historicalTrackingReason(assertion, provenance.source), assertionKey: assertion.key, observation: assertion.observed, expected: assertion.expected, pageUrl: receipt.pageUrl,
            checkedAt: execution?.collectedAt ?? receipt.updatedAt.toISOString(), historical,
            limitation: 'This result establishes only the stated assertion in the recorded execution scope.' } satisfies SiteCheckResult]
        }) : []
    return [...assertions, { id: receipt.id, auditId, ...provenance, area: descriptor.area, name: descriptor.name, kind: 'execution' as const,
      status, pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical,
      limitation: status === 'unknown' && (scopeMismatch || detail.unavailable && !assertions.length) ? 'Recorded evidence could not be linked to this check.'
        : !scopeMismatch && 'limitation' in detail && detail.limitation ? detail.limitation : status === 'unknown'
        ? 'Only part of this check could be inspected. Recorded findings remain available; uninspected scope is unknown.' : status === 'completed'
        ? 'This check completed. Individual successful assertions are shown only when recorded; completion does not certify the whole category.'
        : status === 'not_applicable' ? 'This check had no applicable evidence in this scope.'
        : status === 'failed' ? 'This check did not complete; its result is unknown.'
        : 'This check returned findings. Their evidence and importance are shown separately.' } satisfies SiteCheckResult]
  })
}

/** Older receipts lack reason codes. Adapt only known incomplete tracking observations at the read boundary. */
function historicalTrackingReason(assertion: CheckAssertion, source: string): CheckObservationReason | undefined {
  if (source !== 'browser-network' || assertion.complete !== false || assertion.passed) return undefined
  if (assertion.key === 'tracking-library' && assertion.name === 'Library loading not established') return 'tracking_no_library'
  if (assertion.key === 'tracking-initiation' && assertion.name === 'Event initiation not established') return 'tracking_no_event'
  if (assertion.key === 'tracking-provider-recording') return 'tracking_provider_unverified'
  if (assertion.key === 'tracking-http-response' && assertion.observed.includes('intentionally stopped by FixFlags before delivery.')) return 'tracking_suppressed'
}
