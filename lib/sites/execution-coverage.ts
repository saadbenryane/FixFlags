import type { SiteCardArea } from './card-areas'

/** Explicit module scope. A visual/HTML check cannot certify a business Journey. */
export const MODULE_COVERAGE: Record<string, { area: SiteCardArea; scope: string }> = {
  metadata: { area: 'search', scope: 'Page metadata' },
  seo: { area: 'search', scope: 'Public search fundamentals' },
  performance: { area: 'performance', scope: 'Mobile and desktop lab performance' },
  'security-headers': { area: 'security', scope: 'HTTP security headers' },
  security: { area: 'security', scope: 'Public security basics' },
  accessibility: { area: 'accessibility', scope: 'Automated accessibility checks' },
  measurement: { area: 'tracking', scope: 'Public tracking instrumentation' },
}

export type SiteCoverageExecution = {
  area: SiteCardArea
  scope: string
  pageUrl: string
  passed: boolean
  applicable: boolean
  checkedAt: string
}

export function readCoverageExecutions(rows: Array<{ detail: unknown; updatedAt: Date }>): SiteCoverageExecution[] {
  return rows.flatMap((row) => {
    if (!row.detail || typeof row.detail !== 'object') return []
    const detail = row.detail as Record<string, unknown>
    if (detail.kind !== 'site-module-check' || typeof detail.module !== 'string') return []
    const scope = MODULE_COVERAGE[detail.module]
    if (!scope || typeof detail.pageUrl !== 'string' || typeof detail.passed !== 'boolean' || typeof detail.applicable !== 'boolean') return []
    return [{ ...scope, pageUrl: detail.pageUrl, passed: detail.passed, applicable: detail.applicable, checkedAt: row.updatedAt.toISOString() }]
  })
}
