import { accountAssertion, accountCheckId } from '@/lib/sites/accounts/check-definitions'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { AXE_POLICY_CHECK_IDS, ACCESSIBILITY_DOM_CHECK_IDS } from './accessibility-rules'
import { JOURNEY_ASSERTIONS } from './journey-definitions'

export type AssertionDefinition = { area: SiteCardArea; verifies: readonly string[] }
export type PageCheckDefinition = {
  version: 1 | 2 | 3 | 4; area: SiteCardArea; name: string; source: 'DETERMINISTIC';
  input: 'metadata' | 'headers' | 'http' | 'performance' | 'mobile' | 'browser' | 'accessibility' | 'keyboard' | 'console';
  evaluator: string; resultSchema: 'site-module-check-v1'; requiredEvidence: readonly string[];
  assertions: Readonly<Record<string, AssertionDefinition>>; timeoutMs: number; replaySafety: 'read_only' | 'protected';
}
const assertion = (area: SiteCardArea, verifies: readonly string[] = []): AssertionDefinition => ({ area, verifies })
function define(evaluator: string, area: SiteCardArea, name: string, input: PageCheckDefinition['input'],
  assertions: Record<string, AssertionDefinition> = {}): PageCheckDefinition {
  return { version: 1, area, name, input, evaluator, source: 'DETERMINISTIC', assertions,
    resultSchema: 'site-module-check-v1', timeoutMs: 12_000, replaySafety: 'read_only',
    requiredEvidence: evaluator === 'metadata' ? ['rendered-head'] : evaluator === 'measurement' ? ['rendered-html', 'browser-network'] : input === 'headers' || input === 'http' ? ['public-response'] : input === 'performance' ? ['pagespeed-desktop']
      : input === 'mobile' ? ['pagespeed-mobile'] : evaluator === 'security' ? ['original-html']
      : input === 'console' ? ['desktop-console', 'mobile-console'] : input === 'keyboard' ? ['keyboard-navigation'] : input === 'browser' ? ['rendered-metrics'] : input === 'accessibility' ? ['rendered-html', 'axe']
        : evaluator === 'og-image' ? ['rendered-head', 'public-destination-response']
          : evaluator === 'auth-checkout' ? ['rendered-html', 'public-destination-response'] : ['rendered-html'] }
}

/** Portable contracts. Server registration supplies the declared evaluator. */
export const PAGE_CHECK_DEFINITIONS: Readonly<Record<string, PageCheckDefinition>> = {
  'page-response': define('page-response', 'site', 'Public page response', 'http', {
    'page-response': assertion('site', ['page-http-error']),
  }),
  metadata: define('metadata', 'search', 'Page metadata', 'metadata', {
    'title-presence': assertion('search'), 'description-presence': assertion('search'),
    'preview-image-presence': assertion('search', ['og-image-missing']),
    'preview-title-presence': assertion('search', ['og-title-missing']),
    'preview-description-presence': assertion('search', ['og-description-missing']),
    'favicon-presence': assertion('search', ['favicon-missing']),
    'viewport-presence': assertion('accessibility', ['viewport-missing']), 'language-presence': assertion('accessibility', ['lang-missing']),
  }),
  'og-image': define('og-image', 'search', 'Link preview image', 'metadata', {
    'preview-image-response': assertion('search', ['og-image-broken']),
  }),
  seo: define('seo', 'search', 'Search access', 'metadata', {
    'public-destination': assertion('search', ['broken-internal-links']),
    'section-target': assertion('search', ['broken-page-anchors']),
  }),
  accessibility: define('accessibility', 'accessibility', 'Accessibility checks', 'accessibility', {
    'automated-accessibility': assertion('accessibility'),
    ...Object.fromEntries(AXE_POLICY_CHECK_IDS.map(id => ['axe:' + id, assertion('accessibility', [id])])),
    ...Object.fromEntries(ACCESSIBILITY_DOM_CHECK_IDS.map(id => ['dom:' + id, assertion('accessibility', [id])])),
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
  trust: { ...define('trust', 'security', 'Public trust checks', 'metadata', {
    'privacy-link': assertion('security', ['no-privacy-policy']),
    'contact-information': assertion('security', ['no-contact-info']),
    'cookie-consent-signals': assertion('security', ['cookie-consent-absent']),
  }), version: 2 },
  console: define('console', 'uptime', 'Browser console', 'console', {
    'console-errors': assertion('uptime', ['console-errors-critical', 'console-errors-some']),
  }),
  security: define('security', 'security', 'Public security configuration', 'metadata', {
    https: assertion('security', ['no-https']), 'image-transport': assertion('security'),
    'resource-transport': assertion('security', ['security-mixed-content']),
  }),
  'security-headers': define('security-headers', 'security', 'Response headers', 'headers', {
    'content-security-policy': assertion('security', ['security-csp-missing', 'security-csp-report-only', 'security-headers-missing', 'security-headers-hardening']),
    'csp-inline-scripts': assertion('security', ['security-csp-unsafe-inline', 'security-headers-hardening']),
    'csp-eval': assertion('security', ['security-csp-unsafe-eval', 'security-headers-hardening']),
    'csp-objects': assertion('security', ['security-csp-weak-object-src', 'security-headers-hardening']),
    'hsts-duration': assertion('security', ['security-hsts-missing', 'security-hsts-too-short', 'security-headers-missing']),
    'hsts-subdomains': assertion('security', ['security-hsts-no-subdomains', 'security-headers-hardening']),
    'hsts-preload': assertion('security', ['security-hsts-no-preload', 'security-headers-hardening']),
    'frame-protection': assertion('security', ['security-frame-options-missing', 'security-frame-options-too-permissive', 'security-csp-frame-ancestors-permissive', 'security-headers-missing']),
    'x-content-type-options': assertion('security', ['security-content-type-options-missing', 'security-headers-missing']),
    'referrer-policy': assertion('security', ['security-referrer-policy-missing', 'security-referrer-policy-weak', 'security-headers-hardening']),
    'opener-policy': assertion('security', ['security-coop-missing', 'security-headers-hardening']),
    'embedder-policy': assertion('security', ['security-coep-missing', 'security-headers-hardening']),
    'resource-policy': assertion('security', ['security-corp-missing', 'security-headers-hardening']),
    'permissions-policy': assertion('security', ['security-permissions-policy-missing', 'security-permissions-policy-overbroad', 'security-headers-hardening']),
    'cross-domain-policy': assertion('security', ['security-x-permitted-cross-domain', 'security-headers-hardening']),
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
    'tap-targets': assertion('conversion', ['tap-targets-small']),
    score: assertion('performance', ['mobile-perf-critical', 'mobile-perf-poor']),
    lcp: assertion('performance', ['mobile-lcp-critical', 'mobile-lcp-poor']),
    cls: assertion('performance', ['mobile-cls-critical', 'mobile-cls-poor']),
    'render-blocking': assertion('performance', ['mobile-render-blocking']),
    'unused-javascript': assertion('performance', ['mobile-unused-js-large']),
    'unused-css': assertion('performance', ['mobile-unused-css-large']),
    'image-optimization': assertion('performance', ['mobile-unoptimized-images']),
  }),
  'mobile-ux-quality': { ...define('mobile-ux-quality', 'performance', 'Mobile layout', 'browser', {
    'mobile-input-fonts': assertion('performance', ['mobile-input-zoom']),
    'mobile-cta-position': assertion('performance', ['mobile-cta-thumb-zone']),
    'mobile-cta-label': assertion('performance', ['mobile-cta-weak-label']),
    'mobile-loading-delay': assertion('performance', ['mobile-load-delay-content']),
  }), version: 2 },
  content: define('content', 'conversion', 'Page content', 'metadata', {
    'headline-specificity': assertion('conversion', ['h1-generic']),
    'cta-presence': assertion('conversion', ['no-cta-detected']),
    'section-headings': assertion('conversion', ['heading-hierarchy-missing']),
    'form-validation-attributes': assertion('conversion', ['form-missing-validation']),
  }),
  slop: define('slop', 'conversion', 'Content quality', 'metadata', {
    'placeholder-patterns': assertion('conversion', ['placeholder-copy-detected']),
    'template-heading-patterns': assertion('conversion', ['template-default-copy']),
    'template-tokens': assertion('conversion', ['unreplaced-template-token']),
    'cta-href-values': assertion('conversion', ['cta-dead-link']),
    'social-proof-patterns': assertion('conversion', ['social-proof-unverifiable']),
  }),
  'auth-checkout': define('auth-checkout', 'conversion', 'Public action controls', 'metadata', {
    'auth-destination': assertion('conversion', ['auth-page-broken']),
    'checkout-destination': assertion('conversion', ['checkout-link-dead']),
  }),
  'messaging-clarity': { ...define('messaging-clarity', 'conversion', 'Message clarity', 'metadata', {
    'headline-outcome': assertion('conversion', ['messaging-weak-value-prop']),
    'heading-jargon': assertion('conversion', ['messaging-jargon-overload']),
    'audience-or-outcome': assertion('conversion', ['messaging-no-audience']),
    'prose-sentence-length': assertion('conversion', ['messaging-long-sentences']),
    'headline-length': assertion('conversion', ['messaging-headline-too-short']),
  }), version: 3 },
  'conversion-friction': { ...define('conversion-friction', 'conversion', 'Action friction', 'metadata', {
    'first-step-signals': assertion('conversion', ['friction-no-commitment-path']),
    'trial-payment-wording': assertion('conversion', ['friction-trial-commitment-unclear']),
    'conversion-field-count': assertion('conversion', ['friction-form-too-many-fields']),
    'commitment-signals': assertion('conversion', ['friction-no-risk-reversal']),
    'social-proof-signals': assertion('conversion', ['friction-no-social-proof']),
  }), version: 2 },
  'trust-psychology': { ...define('trust-psychology', 'conversion', 'Trust context', 'metadata', {
    'authority-signals': assertion('conversion', ['trust-no-authority-signals']),
    'testimonial-detail': assertion('conversion', ['trust-testimonial-quality']),
    'claim-support-signals': assertion('conversion', ['trust-unsupported-claims']),
    'direct-contact-signals': assertion('conversion', ['trust-no-direct-contact']),
    'internal-navigation-count': assertion('conversion', ['trust-no-internal-links']),
  }), version: 4 },
  layout: define('layout', 'conversion', 'Layout', 'browser', {
    'mobile-cta-position': assertion('conversion', ['cta-below-fold-mobile']),
  }),
  interaction: define('interaction', 'conversion', 'Interaction controls', 'browser', {
    'blocking-loading-ui': assertion('conversion', ['loading-indicator-stuck']),
    'loading-delay': assertion('conversion', ['loading-state-slow']),
    'reduced-motion': assertion('accessibility', ['motion-ignores-reduced-preference']),
  }),
  'cta-focus': define('cta-focus', 'conversion', 'Primary action', 'browser', {
    'primary-action-count': assertion('conversion', ['competing-ctas']),
  }),
  'visual-polish': define('visual-polish', 'conversion', 'Visual consistency', 'browser', {
    'font-family-count': assertion('conversion', ['visual-typography-sprawl']),
    'button-radius-range': assertion('conversion', ['visual-radius-inconsistent']),
  }),
  'visual-hierarchy': define('visual-hierarchy', 'conversion', 'Visual hierarchy', 'browser', {
    'prominent-action-count': assertion('conversion', ['hierarchy-competing-actions']),
    'section-headings': assertion('conversion', ['hierarchy-no-sections']),
    'headline-presence': assertion('conversion', ['hierarchy-no-headline']),
    'heading-word-count': assertion('conversion', ['hierarchy-information-density']),
  }),
}

/** Action collectors own these observations without a second page evaluator. */
export const PRIMARY_ACTION_ASSERTIONS = {
  'primary-action-presence': ['flow-no-cta-found'],
  'primary-action-click': ['flow-cta-unclickable'],
  'primary-action-navigation': ['flow-cta-dead-end'],
  'primary-action-response': ['flow-cta-404'],
} as const
export const POST_CLICK_ASSERTIONS = {
  'destination-content-timing': ['flow-cta-blank-destination', 'flow-destination-slow-load'],
  'destination-loading-ui': ['flow-cta-stuck-loading', 'flow-destination-stuck-loading'],
} as const
export const DESTINATION_CONTENT_ASSERTIONS = {
  'destination-headline': ['flow-destination-no-headline'],
  'destination-next-action': ['flow-destination-no-cta'],
  'destination-promise': ['flow-cta-message-mismatch'],
  'destination-action-count': ['flow-destination-cta-overload'],
  'destination-form-privacy': ['flow-destination-no-privacy'],
} as const
export const ACTION_CHECK_DEFINITIONS: Readonly<Record<string, PageCheckDefinition>> = {
  corridor: { ...define('corridor', 'conversion', 'Cross-page previews', 'browser', {
    'preview-titles': assertion('conversion', ['corridor-og-title-drift']),
    'preview-descriptions': assertion('conversion', ['corridor-og-description-drift']),
  }), version: 2, requiredEvidence: ['compared-rendered-pages'] },
  'mobile-navigation': { ...define('mobile-navigation', 'conversion', 'Mobile navigation', 'browser', {
    'mobile-navigation': assertion('conversion', ['flow-mobile-menu-broken']),
  }), requiredEvidence: ['native-mobile-navigation'], timeoutMs: 15_000 },
  journeys: { ...define('journeys', 'conversion', 'Public journey pages', 'browser',
    Object.fromEntries(Object.entries(JOURNEY_ASSERTIONS).map(([key, ids]) => [key, assertion('conversion', ids)]))),
    requiredEvidence: ['recorded-public-journey-page'], timeoutMs: 60_000 },
  overlays: { ...define('overlays', 'conversion', 'Covered controls', 'browser', {
    'overlay-nav': assertion('conversion', ['overlay-blocks-nav']), 'overlay-cta': assertion('conversion', ['overlay-blocks-cta']),
    'overlay-form': assertion('conversion', ['overlay-blocks-form']), 'overlay-scope': assertion('conversion'),
  }), requiredEvidence: ['initial-control-hit-tests'], timeoutMs: 30_000 },
  'slow-replay': { ...define('slow-replay', 'performance', 'Slow connection visibility', 'browser', {
    'meaningful-text': assertion('performance', ['slow-3g-blank-screen']),
    'primary-action-visibility': assertion('performance', ['slow-3g-cta-delayed']),
  }), requiredEvidence: ['mobile-slow-3g-observation'], timeoutMs: 45_000 },
  'automatic-accounts': { ...define('automatic-accounts', 'conversion', 'Automatic account checks', 'browser',
    Object.fromEntries(Object.entries(accountAssertion).map(([kind, key]) => [key, assertion('conversion', [accountCheckId[kind as keyof typeof accountCheckId]])]))),
    replaySafety: 'protected', timeoutMs: 180_000, requiredEvidence: ['credential-bound-account-observation'] },
  flow: { ...define('flow', 'conversion', 'Public primary action', 'browser',
    { ...Object.fromEntries(Object.entries(PRIMARY_ACTION_ASSERTIONS).map(([key, ids]) => [key, assertion('conversion', ids)])),
      ...Object.fromEntries(Object.entries(POST_CLICK_ASSERTIONS).map(([key, ids]) => [key, assertion('conversion', ids)])),
      'destination-trust': assertion('conversion', ['flow-cta-destination-no-trust']),
      ...Object.fromEntries(Object.entries(DESTINATION_CONTENT_ASSERTIONS).map(([key, ids]) => [key, assertion('conversion', ids)])),
      'pricing-navigation': assertion('conversion', ['flow-pricing-nav-broken']) }),
    requiredEvidence: ['public-primary-action'] },
  'form-validation': { ...define('form-validation', 'conversion', 'Form validation', 'browser', {
    'empty-form-validation': assertion('conversion', ['flow-form-no-validation']),
    'form-feedback': assertion('conversion', ['flow-form-slow-feedback']),
  }), requiredEvidence: ['rendered-empty-form-validation'] },
}
export const MODULE_CHECK_DEFINITIONS = { ...PAGE_CHECK_DEFINITIONS, ...ACTION_CHECK_DEFINITIONS }
