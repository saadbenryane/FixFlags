import { ALL_CHECK_IDS } from './check-ids'
import type { SiteCardArea } from '@/lib/sites/card-areas'

/** One category contract for registered findings, execution receipts and failures. */
export const CHECK_MODULES: Record<string, { area: SiteCardArea; name: string; source: 'DETERMINISTIC'; input: 'metadata' | 'headers' | 'performance' | 'mobile' | 'browser' | 'accessibility'; version: number }> = Object.fromEntries([
  ['metadata', 'search', 'Page metadata', 'metadata'], ['og-image', 'search', 'Link preview image', 'metadata'],
  ['seo', 'search', 'Search access', 'metadata'], ['accessibility', 'accessibility', 'Accessibility checks', 'accessibility'],
  ['trust', 'security', 'Public trust checks', 'metadata'], ['security', 'security', 'Public security configuration', 'metadata'],
  ['security-headers', 'security', 'Response headers', 'headers'], ['measurement', 'tracking', 'Measurement configuration', 'metadata'],
  ['performance', 'performance', 'Page speed', 'performance'], ['mobile', 'performance', 'Mobile page speed', 'mobile'],
  ['mobile-ux-quality', 'performance', 'Mobile layout', 'browser'], ['content', 'conversion', 'Page content', 'metadata'],
  ['slop', 'conversion', 'Content quality', 'metadata'], ['auth-checkout', 'conversion', 'Public action controls', 'metadata'],
  ['messaging-clarity', 'conversion', 'Message clarity', 'metadata'], ['conversion-friction', 'conversion', 'Action friction', 'metadata'],
  ['trust-psychology', 'conversion', 'Trust context', 'metadata'], ['layout', 'conversion', 'Layout', 'browser'],
  ['interaction', 'conversion', 'Interaction controls', 'browser'], ['cta-focus', 'conversion', 'Primary action', 'browser'],
  ['visual-polish', 'conversion', 'Visual consistency', 'browser'], ['visual-hierarchy', 'conversion', 'Visual hierarchy', 'browser'],
].map(([id, area, name, input]) => [id, { area, name, input, source: 'DETERMINISTIC', version: 1 }])) as Record<string, { area: SiteCardArea; name: string; source: 'DETERMINISTIC'; input: 'metadata' | 'headers' | 'performance' | 'mobile' | 'browser' | 'accessibility'; version: number }>

function registeredArea(id: string): SiteCardArea {
  // Specific responsibilities precede broad families; these rules are resolved
  // once into exact identities, never interpreted from a legacy rubric at render.
  if (/^(images-missing|form-inputs|buttons-no|links-no|iframe-|tabindex|color-contrast|skip-link|keyboard|focus-visible|axe-|lang-|viewport-|heading-order|tap-targets)/.test(id)) return 'accessibility'
  if (/^(no-https|security-|cookie-consent|mixed-content)/.test(id)) return 'security'
  if (/^(console-errors|broken-page)/.test(id)) return 'uptime'
  if (/^(slow-3g-|flow-destination-slow|perf-|lcp-|cls-|inp-|render-blocking|unused-|unoptimized|mobile-perf|mobile-lcp)/.test(id)) return 'performance'
  if (/^(measurement-|analytics-|pixel-|meta-|gtm-|tag-)/.test(id)) return 'tracking'
  if (/^(title-|description-|og-|canonical-|robots-|h1-(missing|multiple)|sitemap-|structured|broken-internal|favicon|no-structured|indexing-|soft-404|noindex-|low-ctr|corridor-og)/.test(id)) return 'search'
  return 'conversion'
}

const MATERIAL_FAILURES = new Set([
  'no-https', 'security-mixed-content', 'robots-blocks-indexing', 'indexing-failure', 'soft-404', 'robots-blocked', 'noindex-meta',
  'broken-internal-links', 'broken-page-anchors', 'cta-dead-link', 'checkout-link-dead', 'auth-page-broken',
  'loading-indicator-stuck', 'flow-cta-unclickable', 'flow-cta-404', 'flow-cta-dead-end', 'flow-pricing-nav-broken',
  'flow-mobile-menu-broken', 'flow-cta-blank-destination', 'flow-cta-stuck-loading', 'flow-destination-stuck-loading',
  'api-engagement-unauthorized', 'api-engagement-server-error', 'form-submit-api-unauthorized', 'form-submit-api-server-error',
  'form-submit-silent-failure', 'overlay-blocks-nav', 'overlay-blocks-cta', 'overlay-blocks-form',
  'keyboard-nav-trap', 'form-inputs-no-label', 'buttons-no-text', 'links-no-text', 'color-contrast-poor',
  'journey-funnel-step-failed', 'journey-funnel-loop-detected', 'journey-funnel-timeout', 'journey-funnel-dead-end',
  'journey-funnel-accessibility-barrier', 'slow-3g-blank-screen', 'slow-3g-cta-delayed',
])

export const CHECK_REGISTRY = Object.fromEntries(ALL_CHECK_IDS.map(id => [id, {
  id, area: registeredArea(id), materialFailure: MATERIAL_FAILURES.has(id),
}])) as Record<string, { id: string; area: SiteCardArea; materialFailure: boolean }>

export const CHECK_ASSERTIONS: Record<string, Record<string, { area: SiteCardArea }>> = {
  metadata: Object.fromEntries(['title-presence', 'description-presence', 'preview-image-presence', 'preview-title-presence', 'preview-description-presence', 'viewport-presence', 'language-presence'].map(key => [key, {
    area: key === 'viewport-presence' || key === 'language-presence' ? 'accessibility' as const : 'search' as const,
  }])),
  security: { https: { area: 'security' }, 'image-transport': { area: 'security' } },
  measurement: { 'analytics-markup': { area: 'tracking' } },
  'security-headers': { 'content-security-policy': { area: 'security' }, 'x-content-type-options': { area: 'security' } },
  accessibility: { 'automated-accessibility': { area: 'accessibility' } },
  performance: { lcp: { area: 'performance' }, cls: { area: 'performance' } },
  mobile: { lcp: { area: 'performance' }, cls: { area: 'performance' } },
}

export function registeredCheck(id: string | null | undefined) {
  if (id === 'measurement-pixel-missing') return { id, area: 'tracking' as const, materialFailure: false }
  return CHECK_REGISTRY[(id ?? '').toLowerCase().split('::page:')[0]]
}
