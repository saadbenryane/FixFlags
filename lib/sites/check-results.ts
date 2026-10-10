import type { SiteCardArea } from '@/lib/sites/card-areas'

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

const MODULES: Record<string, { area: SiteCardArea; name: string }> = {
  metadata: { area: 'search', name: 'Page metadata' },
  'og-image': { area: 'search', name: 'Link preview image' },
  seo: { area: 'search', name: 'Search access' },
  accessibility: { area: 'accessibility', name: 'Accessibility checks' },
  trust: { area: 'security', name: 'Public trust checks' },
  security: { area: 'security', name: 'Public security configuration' },
  'security-headers': { area: 'security', name: 'Response headers' },
  measurement: { area: 'tracking', name: 'Measurement configuration' },
  performance: { area: 'performance', name: 'Page speed' },
  mobile: { area: 'performance', name: 'Mobile page speed' },
  'mobile-ux-quality': { area: 'performance', name: 'Mobile layout' },
  content: { area: 'conversion', name: 'Page content' },
  slop: { area: 'conversion', name: 'Content quality' },
  'auth-checkout': { area: 'conversion', name: 'Public action controls' },
  'messaging-clarity': { area: 'conversion', name: 'Message clarity' },
  'conversion-friction': { area: 'conversion', name: 'Action friction' },
  'trust-psychology': { area: 'conversion', name: 'Trust context' },
  layout: { area: 'conversion', name: 'Layout' },
  interaction: { area: 'conversion', name: 'Interaction controls' },
  'cta-focus': { area: 'conversion', name: 'Primary action' },
  'visual-polish': { area: 'conversion', name: 'Visual consistency' },
  'visual-hierarchy': { area: 'conversion', name: 'Visual hierarchy' },
}

export function projectCheckResults(auditId: string, receipts: Array<{
  id: string; targetKey: string; status: string; pageUrl: string | null;
  updatedAt: Date; detail: unknown;
  source?: string;
}>, historical = false): SiteCheckResult[] {
  return receipts.flatMap(receipt => {
    const descriptor = MODULES[receipt.targetKey.replace(/^module:/, '')]
    if (!receipt.targetKey.startsWith('module:') || !descriptor) return []
    if (!['COMPLETED', 'FAILED', 'NOT_APPLICABLE'].includes(receipt.status)) return []
    const provenance = {
      source: receipt.source ?? 'DETERMINISTIC',
      evidenceReference: { auditId, executionId: receipt.id, pageUrl: receipt.pageUrl },
    }
    const detail = receipt.detail && typeof receipt.detail === 'object' && !Array.isArray(receipt.detail)
      ? receipt.detail as Record<string, unknown> : null
    const status = receipt.status === 'FAILED' ? 'failed'
      : receipt.status === 'NOT_APPLICABLE' ? 'not_applicable'
      : detail?.passed === false ? 'findings' : 'completed'
    const assertions = receipt.status === 'COMPLETED' && Array.isArray(detail?.assertions)
      ? detail.assertions.flatMap((value: unknown) => {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return []
          const assertion = value as Record<string, unknown>
          if (typeof assertion.key !== 'string' || typeof assertion.name !== 'string' ||
              typeof assertion.observed !== 'string' || typeof assertion.expected !== 'string' || typeof assertion.passed !== 'boolean') return []
          return [{ id: `${receipt.id}:${assertion.key}`, auditId, ...provenance, area: descriptor.area,
            name: assertion.name, kind: 'assertion' as const, status: assertion.passed ? 'passed' as const : 'findings' as const,
            observation: assertion.observed, expected: assertion.expected, pageUrl: receipt.pageUrl,
            checkedAt: receipt.updatedAt.toISOString(), historical,
            limitation: 'This result establishes only the stated assertion in the captured page metadata.' } satisfies SiteCheckResult]
        }) : []
    return [...assertions, { id: receipt.id, auditId, ...provenance, ...descriptor, kind: 'execution' as const,
      status, pageUrl: receipt.pageUrl, checkedAt: receipt.updatedAt.toISOString(), historical,
      limitation: status === 'completed'
        ? 'This check completed. Individual successful assertions are shown only when recorded; completion does not certify the whole category.'
        : status === 'not_applicable' ? 'This check had no applicable evidence in this scope.'
        : status === 'failed' ? 'This check did not complete; its result is unknown.'
        : 'This check returned findings. Their evidence and importance are shown separately.' } satisfies SiteCheckResult]
  })
}
