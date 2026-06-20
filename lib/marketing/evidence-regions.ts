export type EvidenceRegionScope = 'page' | 'element'

/** Normalized bounding box on a screenshot (0–1). */
export interface EvidenceRegion {
  scope: EvidenceRegionScope
  x: number
  y: number
  width: number
  height: number
}

export interface LegacyEvidenceAnchor {
  x: number
  y: number
  width?: number
  height?: number
  scope?: EvidenceRegionScope
}

const PAGE_REGION: EvidenceRegion = {
  scope: 'page',
  x: 0,
  y: 0,
  width: 1,
  height: 1,
}

/** Checks where the issue is page-wide (invisible meta, whole-page perf, etc.). */
export const METADATA_CHECK_IDS = new Set([
  'title-missing',
  'title-too-short',
  'title-too-long',
  'description-missing',
  'description-too-short',
  'description-too-long',
  'og-image-missing',
  'og-title-missing',
  'og-description-missing',
  'og-image-broken',
  'viewport-missing',
  'lang-missing',
  'canonical-missing',
  'robots-blocks-indexing',
  'favicon-missing',
])

const PAGE_SCOPE_CHECK_IDS = new Set<string>([
  ...METADATA_CHECK_IDS,
  'no-structured-data',
  'sitemap-missing',
  'robots-txt-missing',
  'no-https',
  'cookie-consent-absent',
  'console-errors-critical',
  'console-errors-some',
  'unused-js-large',
  'unused-css-large',
  'viewport-missing',
  'lang-missing',
])

const ELEMENT_REGION_PRESETS: Record<string, { width: number; height: number }> = {
  'h1-generic': { width: 0.82, height: 0.11 },
  'h1-missing': { width: 0.82, height: 0.11 },
  'h1-multiple': { width: 0.82, height: 0.11 },
  'title-too-short': { width: 0.82, height: 0.11 },
  'title-missing': { width: 0.82, height: 0.11 },
  'cta-below-fold-mobile': { width: 0.55, height: 0.07 },
  'flow-no-cta-found': { width: 0.55, height: 0.07 },
  'no-cta-detected': { width: 0.55, height: 0.07 },
  'tap-targets-small': { width: 0.92, height: 0.14 },
  'mobile-perf-critical': { width: 0.92, height: 0.35 },
  'mobile-perf-poor': { width: 0.92, height: 0.35 },
  'perf-score-critical': { width: 0.92, height: 0.35 },
  'perf-score-poor': { width: 0.92, height: 0.35 },
}

export function evidenceScopeForCheck(checkId: string): EvidenceRegionScope {
  return PAGE_SCOPE_CHECK_IDS.has(checkId) ? 'page' : 'element'
}

export function pageEvidenceRegion(): EvidenceRegion {
  return { ...PAGE_REGION }
}

/** Convert stored anchor (point or rect) into a highlight region. */
export function anchorToRegion(checkId: string, anchor: LegacyEvidenceAnchor | null): EvidenceRegion {
  const scope = anchor?.scope ?? evidenceScopeForCheck(checkId)
  if (scope === 'page') {
    return pageEvidenceRegion()
  }

  if (
    anchor &&
    typeof anchor.width === 'number' &&
    typeof anchor.height === 'number' &&
    anchor.width > 0 &&
    anchor.height > 0
  ) {
    return clampRegion({
      scope: 'element',
      x: anchor.x - anchor.width / 2,
      y: anchor.y - anchor.height / 2,
      width: anchor.width,
      height: anchor.height,
    })
  }

  const preset = ELEMENT_REGION_PRESETS[checkId] ?? { width: 0.62, height: 0.1 }
  const centerX = anchor?.x ?? 0.5
  const centerY = anchor?.y ?? 0.35

  return clampRegion({
    scope: 'element',
    x: centerX - preset.width / 2,
    y: centerY - preset.height / 2,
    width: preset.width,
    height: preset.height,
  })
}

function clampRegion(region: EvidenceRegion): EvidenceRegion {
  const x = Math.min(1, Math.max(0, region.x))
  const y = Math.min(1, Math.max(0, region.y))
  const width = Math.min(1 - x, Math.max(0.06, region.width))
  const height = Math.min(1 - y, Math.max(0.05, region.height))
  return { scope: region.scope, x, y, width, height }
}

export function visualTargetLabel(checkId: string): string {
  return VISUAL_TARGET_LABELS[checkId] ?? 'Flagged area on this page'
}

const VISUAL_TARGET_LABELS: Record<string, string> = {
  'h1-generic': 'Hero headline (H1)',
  'h1-missing': 'Hero headline area',
  'h1-multiple': 'Page headings',
  'title-missing': 'Browser tab title (whole page)',
  'title-too-short': 'Browser tab title (whole page)',
  'title-too-long': 'Browser tab title (whole page)',
  'description-missing': 'Search & share snippet (whole page head)',
  'description-too-short': 'Search & share snippet (whole page head)',
  'description-too-long': 'Search & share snippet (whole page head)',
  'og-image-missing': 'Social link preview (whole page)',
  'og-image-broken': 'Social link preview (whole page)',
  'og-title-missing': 'Social link preview (whole page)',
  'og-description-missing': 'Social link preview (whole page)',
  'robots-blocks-indexing': 'Search indexing (whole page)',
  'canonical-missing': 'Canonical URL (whole page)',
  'no-structured-data': 'Structured data (whole page)',
  'cta-below-fold-mobile': 'Primary call-to-action button',
  'flow-no-cta-found': 'Primary call-to-action',
  'no-cta-detected': 'Primary call-to-action area',
  'tap-targets-small': 'Navigation & tap targets',
  'mobile-perf-critical': 'Above-the-fold content (mobile)',
  'mobile-perf-poor': 'Above-the-fold content (mobile)',
  'render-blocking': 'Hero & first paint area',
  'placeholder-copy-detected': 'Visible page copy',
  'template-default-copy': 'Hero & body copy',
  'font-family-sprawl': 'Headings & body typography',
  'button-radius-inconsistent': 'Primary & secondary buttons',
}

/** Prefix evidence with what to look at on the screenshot. */
export function formatVisualEvidence(checkId: string, evidence: string): string {
  const target = visualTargetLabel(checkId)
  if (evidence.toLowerCase().includes(target.toLowerCase().slice(0, 12))) {
    return evidence
  }
  return `On the screenshot, look at ${target}: ${evidence}`
}
