import type { SiteCardArea } from '@/lib/sites/card-areas'

export type AssertionDefinition = { area: SiteCardArea; verifies: readonly string[] }
export type PageCheckDefinition = {
  version: 1; area: SiteCardArea; name: string; source: 'DETERMINISTIC';
  input: 'metadata' | 'headers' | 'performance' | 'mobile' | 'browser' | 'accessibility' | 'keyboard';
  evaluator: string; resultSchema: 'site-module-check-v1'; requiredEvidence: readonly string[];
  assertions: Readonly<Record<string, AssertionDefinition>>; timeoutMs: number; replaySafety: 'read_only';
}
const assertion = (area: SiteCardArea, verifies: readonly string[] = []): AssertionDefinition => ({ area, verifies })
function define(evaluator: string, area: SiteCardArea, name: string, input: PageCheckDefinition['input'],
  assertions: Record<string, AssertionDefinition> = {}): PageCheckDefinition {
  return { version: 1, area, name, input, evaluator, source: 'DETERMINISTIC', assertions,
    resultSchema: 'site-module-check-v1', timeoutMs: 12_000, replaySafety: 'read_only',
    requiredEvidence: evaluator === 'measurement' ? ['rendered-html', 'browser-network'] : input === 'headers' ? ['public-response'] : input === 'performance' ? ['pagespeed-desktop']
      : input === 'mobile' ? ['pagespeed-mobile'] : evaluator === 'security' ? ['original-html']
      : input === 'keyboard' ? ['keyboard-navigation'] : input === 'browser' ? ['rendered-metrics'] : input === 'accessibility' ? ['rendered-html', 'axe']
        : evaluator === 'auth-checkout' || evaluator === 'og-image' ? ['rendered-html', 'public-destination-response'] : ['rendered-html'] }
}

/** Portable contracts. Server registration supplies the declared evaluator. */
export const PAGE_CHECK_DEFINITIONS: Readonly<Record<string, PageCheckDefinition>> = {
  metadata: define('metadata', 'search', 'Page metadata', 'metadata', {
    'title-presence': assertion('search'), 'description-presence': assertion('search'),
    'preview-image-presence': assertion('search', ['og-image-missing']),
    'preview-title-presence': assertion('search', ['og-title-missing']),
    'preview-description-presence': assertion('search', ['og-description-missing']),
    'viewport-presence': assertion('accessibility', ['viewport-missing']), 'language-presence': assertion('accessibility', ['lang-missing']),
  }),
  'og-image': define('og-image', 'search', 'Link preview image', 'metadata', {
    'preview-image-response': assertion('search', ['og-image-broken']),
  }),
  seo: define('seo', 'search', 'Search access', 'metadata'),
  accessibility: define('accessibility', 'accessibility', 'Accessibility checks', 'accessibility', {
    'automated-accessibility': assertion('accessibility'),
  }),
  keyboard: define('keyboard', 'accessibility', 'Keyboard navigation', 'keyboard', {
    'focus-styles': assertion('accessibility', ['focus-visible-missing']),
    'keyboard-exit': assertion('accessibility', ['keyboard-nav-trap']),
    'tab-sequence': assertion('accessibility', ['keyboard-tab-order']),
    'popup-open': assertion('accessibility', ['keyboard-popup-opening']),
    'popup-entry': assertion('accessibility', ['keyboard-popup-focus']),
    'menu-arrows': assertion('accessibility', ['keyboard-menu-navigation']),
    'modal-boundary': assertion('accessibility', ['keyboard-modal-boundary']),
    'popup-escape': assertion('accessibility', ['keyboard-popup-escape']),
    'focus-restoration': assertion('accessibility', ['keyboard-focus-restoration']),
  }),
  trust: define('trust', 'security', 'Public trust checks', 'metadata'),
  security: define('security', 'security', 'Public security configuration', 'metadata', {
    https: assertion('security', ['no-https']), 'image-transport': assertion('security'),
    'resource-transport': assertion('security', ['security-mixed-content']),
  }),
  'security-headers': define('security-headers', 'security', 'Response headers', 'headers', {
    'content-security-policy': assertion('security', ['security-csp-missing']),
    'x-content-type-options': assertion('security', ['security-content-type-options-missing']),
  }),
  measurement: define('measurement', 'tracking', 'Measurement configuration', 'metadata', {
    'analytics-markup': assertion('tracking', ['measurement-ga-gtm-posthog-missing']),
    'tracking-library': assertion('tracking', ['tracking-library-http-error']),
    'tracking-initiation': assertion('tracking'),
    'tracking-http-response': assertion('tracking', ['tracking-endpoint-http-error']),
    'tracking-provider-recording': assertion('tracking'),
  }),
  performance: define('performance', 'performance', 'Page speed', 'performance', {
    score: assertion('performance', ['perf-score-critical', 'perf-score-poor']),
    lcp: assertion('performance', ['lcp-critical', 'lcp-poor']), cls: assertion('performance', ['cls-critical', 'cls-poor']),
    'render-blocking': assertion('performance', ['render-blocking']),
    'unused-javascript': assertion('performance', ['unused-js-large']),
    'unused-css': assertion('performance', ['unused-css-large']),
    'image-optimization': assertion('performance', ['unoptimized-images']),
    inp: assertion('performance'),
  }),
  mobile: define('mobile', 'performance', 'Mobile page speed', 'mobile', {
    score: assertion('performance', ['mobile-perf-critical', 'mobile-perf-poor']),
    lcp: assertion('performance', ['mobile-lcp-critical', 'mobile-lcp-poor']),
    cls: assertion('performance', ['mobile-cls-critical', 'mobile-cls-poor']),
  }),
  'mobile-ux-quality': define('mobile-ux-quality', 'performance', 'Mobile layout', 'browser'),
  content: define('content', 'conversion', 'Page content', 'metadata'),
  slop: define('slop', 'conversion', 'Content quality', 'metadata'),
  'auth-checkout': define('auth-checkout', 'conversion', 'Public action controls', 'metadata', {
    'auth-destination': assertion('conversion', ['auth-page-broken']),
    'checkout-destination': assertion('conversion', ['checkout-link-dead']),
  }),
  'messaging-clarity': define('messaging-clarity', 'conversion', 'Message clarity', 'metadata'),
  'conversion-friction': define('conversion-friction', 'conversion', 'Action friction', 'metadata'),
  'trust-psychology': define('trust-psychology', 'conversion', 'Trust context', 'metadata'),
  layout: define('layout', 'conversion', 'Layout', 'browser'),
  interaction: define('interaction', 'conversion', 'Interaction controls', 'browser'),
  'cta-focus': define('cta-focus', 'conversion', 'Primary action', 'browser'),
  'visual-polish': define('visual-polish', 'conversion', 'Visual consistency', 'browser'),
  'visual-hierarchy': define('visual-hierarchy', 'conversion', 'Visual hierarchy', 'browser'),
}

/** Action collectors own these observations without a second page evaluator. */
export const ACTION_CHECK_DEFINITIONS: Readonly<Record<string, PageCheckDefinition>> = {
  'form-validation': { ...define('form-validation', 'conversion', 'Form validation', 'browser', {
    'empty-form-validation': assertion('conversion', ['flow-form-no-validation']),
    'form-feedback': assertion('conversion', ['flow-form-slow-feedback']),
  }), requiredEvidence: ['rendered-empty-form-validation'] },
}
export const MODULE_CHECK_DEFINITIONS = { ...PAGE_CHECK_DEFINITIONS, ...ACTION_CHECK_DEFINITIONS }
