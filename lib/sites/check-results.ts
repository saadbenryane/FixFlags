import type { SiteCardArea } from '@/lib/sites/card-areas'
import { CHECK_ASSERTIONS, CHECK_MODULES } from '@/lib/audit/check-registry'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import { z } from 'zod'
import { searchObservationSchema, searchReceiptSchema, type SearchObservation } from '@/lib/audit/search/contracts'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export type SiteCheckResult = {
  id: string
  auditId: string
  area: SiteCardArea
  name: string
  kind: 'execution' | 'assertion'
  status: 'passed' | 'completed' | 'findings' | 'failed' | 'not_applicable' | 'observed' | 'unknown'
  pageUrl: string | null
  checkedAt: string
  historical: boolean
  limitation: string
  source: string
  evidenceReference: { auditId: string; executionId: string; pageUrl: string | null }
  assertionKey?: string
  observation?: string
  expected?: string
  search?: SearchObservation
}

export function projectCheckResults(auditId: string, receipts: Array<{
  id: string; targetKey: string; status: string; pageUrl: string | null;
  updatedAt: Date; detail: unknown;
  source?: string;
}>, historical = false): SiteCheckResult[] {
  return receipts.flatMap<SiteCheckResult>(receipt => {
    const search = searchReceiptSchema.safeParse(receipt.detail)
    if (search.success && receipt.targetKey.startsWith('module:search') && search.data.auditId === auditId && search.data.pageUrl === receipt.pageUrl) {
      return search.data.observations.map(item => ({
        id: `${receipt.id}:${item.id}`, auditId, area: 'search' as const, name: item.name, kind: 'assertion' as const,
        status: item.disposition === 'failed' ? 'findings' as const : item.disposition,
        pageUrl: item.pageUrl, checkedAt: item.collectedAt, historical, limitation: item.limitation, source: item.source,
        evidenceReference: { auditId, executionId: receipt.id, pageUrl: item.pageUrl },
        observation: item.observed, expected: item.expected, search: item,
      } satisfies SiteCheckResult))
    }
    const descriptor = CHECK_MODULES[receipt.targetKey.replace(/^module:/, '')]
    if (!receipt.targetKey.startsWith('module:')) return []
    if (!descriptor) return [{ id: receipt.id, auditId, area: 'site',
      name: receipt.targetKey.slice('module:'.length), kind: 'execution', status: 'unknown',
      pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical: true,
      limitation: SITE_ACTION_COPY.historicalCheck,
      source: receipt.source ?? 'HISTORICAL', evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl } }]
    if (!['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(receipt.status)) return []
    const detail = readCheckReceipt(receipt.detail)
    const provenance = {
      source: 'execution' in detail && detail.execution ? detail.execution.source : receipt.source ?? 'DETERMINISTIC',
      evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl },
    }
    const status = receipt.status === 'FAILED' ? 'failed'
      : receipt.status === 'NOT_APPLICABLE' ? 'not_applicable'
      : 'complete' in detail && detail.complete === false ? 'unknown'
      : 'applicable' in detail && !detail.applicable ? 'not_applicable'
      : detail.passed === false ? 'findings' : 'completed'
    const assertions = receipt.status === 'COMPLETED'
      ? detail.assertions.flatMap((assertion, index) => {
          const repeated = detail.assertions.some((other, otherIndex) => otherIndex !== index && other.key === assertion.key && other.context === assertion.context)
          return [{ id: `${receipt.id}:${assertion.key}${assertion.context ? ':' + assertion.context : ''}${repeated ? ':' + index : ''}`, auditId, ...provenance,
            name: assertion.name, area: CHECK_ASSERTIONS[receipt.targetKey.replace(/^module:/, '')]?.[assertion.key]?.area ?? descriptor.area,
            kind: 'assertion' as const, status: assertion.complete === false ? 'unknown' as const : assertion.disposition === 'observed' ? 'observed' as const : assertion.passed ? 'passed' as const : 'findings' as const,
            assertionKey: assertion.key, observation: assertion.observed, expected: assertion.expected, pageUrl: receipt.pageUrl,
            checkedAt: 'execution' in detail && detail.execution ? detail.execution.collectedAt : receipt.updatedAt.toISOString(), historical,
            limitation: 'This result establishes only the stated assertion in the recorded execution scope.' } satisfies SiteCheckResult]
        }) : []
    return [...assertions, { id: receipt.id, auditId, ...provenance, area: descriptor.area, name: descriptor.name, kind: 'execution' as const,
      status, pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical,
      limitation: 'limitation' in detail && detail.limitation ? detail.limitation : status === 'unknown'
        ? 'Only part of this check could be inspected. Recorded findings remain available; uninspected scope is unknown.' : status === 'completed'
        ? 'This check completed. Individual successful assertions are shown only when recorded; completion does not certify the whole category.'
        : status === 'not_applicable' ? 'This check had no applicable evidence in this scope.'
        : status === 'failed' ? 'This check did not complete; its result is unknown.'
        : 'This check returned findings. Their evidence and importance are shown separately.' } satisfies SiteCheckResult]
  })
}

export const siteCheckResultSchema = z.object({
  id: z.string(), auditId: z.string(), area: z.enum(['site', 'security', 'search', 'performance', 'conversion', 'tracking', 'uptime', 'accessibility']),
  name: z.string(), kind: z.enum(['execution', 'assertion']), status: z.enum(['passed', 'completed', 'findings', 'failed', 'not_applicable', 'observed', 'unknown']),
  pageUrl: z.string().nullable(), checkedAt: z.string(), historical: z.boolean(), limitation: z.string(), source: z.string(),
  evidenceReference: z.object({ auditId: z.string(), executionId: z.string(), pageUrl: z.string().nullable() }),
  assertionKey: z.string().optional(), observation: z.string().optional(), expected: z.string().optional(),
  search: searchObservationSchema.optional(),
})
export const siteCheckPageSchema = z.object({ results: z.array(siteCheckResultSchema), nextCursor: z.string().nullable(), total: z.number().int().nonnegative().nullable().optional() })
export const RESULT_SELECTION_CHANGED = 'RESULT_SELECTION_CHANGED'
