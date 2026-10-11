import type { SiteCardArea } from '@/lib/sites/card-areas'
import { CHECK_ASSERTIONS, CHECK_MODULES } from '@/lib/audit/check-registry'
import { readCheckReceipt } from '@/lib/audit/checks/receipt'
import { z } from 'zod'

export type SiteCheckResult = {
  id: string
  auditId: string
  area: SiteCardArea
  name: string
  kind: 'execution' | 'assertion'
  status: 'passed' | 'completed' | 'findings' | 'failed' | 'not_applicable'
  pageUrl: string | null
  checkedAt: string
  historical: boolean
  limitation: string
  source: string
  evidenceReference: { auditId: string; executionId: string; pageUrl: string | null }
  observation?: string
  expected?: string
}

export function projectCheckResults(auditId: string, receipts: Array<{
  id: string; targetKey: string; status: string; pageUrl: string | null;
  updatedAt: Date; detail: unknown;
  source?: string;
}>, historical = false): SiteCheckResult[] {
  return receipts.flatMap(receipt => {
    const descriptor = CHECK_MODULES[receipt.targetKey.replace(/^module:/, '')]
    if (!receipt.targetKey.startsWith('module:') || !descriptor) return []
    if (!['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(receipt.status)) return []
    const provenance = {
      source: receipt.source ?? 'DETERMINISTIC',
      evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl },
    }
    const detail = readCheckReceipt(receipt.detail)
    const status = receipt.status === 'FAILED' ? 'failed'
      : receipt.status === 'NOT_APPLICABLE' ? 'not_applicable'
      : detail.passed === false ? 'findings' : 'completed'
    const assertions = receipt.status === 'COMPLETED'
      ? detail.assertions.flatMap(assertion => {
          return [{ id: `${receipt.id}:${assertion.key}`, auditId, ...provenance,
            name: assertion.name, area: CHECK_ASSERTIONS[receipt.targetKey.replace(/^module:/, '')]?.[assertion.key]?.area ?? descriptor.area,
            kind: 'assertion' as const, status: assertion.passed ? 'passed' as const : 'findings' as const,
            observation: assertion.observed, expected: assertion.expected, pageUrl: receipt.pageUrl,
            checkedAt: receipt.updatedAt.toISOString(), historical,
            limitation: 'This result establishes only the stated assertion in the recorded execution scope.' } satisfies SiteCheckResult]
        }) : []
    return [...assertions, { id: receipt.id, auditId, ...provenance, area: descriptor.area, name: descriptor.name, kind: 'execution' as const,
      status, pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical,
      limitation: status === 'completed'
        ? 'This check completed. Individual successful assertions are shown only when recorded; completion does not certify the whole category.'
        : status === 'not_applicable' ? 'This check had no applicable evidence in this scope.'
        : status === 'failed' ? 'This check did not complete; its result is unknown.'
        : 'This check returned findings. Their evidence and importance are shown separately.' } satisfies SiteCheckResult]
  })
}

export const siteCheckResultSchema = z.object({
  id: z.string(), auditId: z.string(), area: z.enum(['site', 'security', 'search', 'performance', 'conversion', 'tracking', 'uptime', 'accessibility']),
  name: z.string(), kind: z.enum(['execution', 'assertion']), status: z.enum(['passed', 'completed', 'findings', 'failed', 'not_applicable']),
  pageUrl: z.string().nullable(), checkedAt: z.string(), historical: z.boolean(), limitation: z.string(), source: z.string(),
  evidenceReference: z.object({ auditId: z.string(), executionId: z.string(), pageUrl: z.string().nullable() }),
  observation: z.string().optional(), expected: z.string().optional(),
})
export const siteCheckPageSchema = z.object({ results: z.array(siteCheckResultSchema), nextCursor: z.string().nullable() })
