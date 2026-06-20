/** Every deterministic checkId implemented in lib/audit/checks/*. */
export const ALL_CHECK_IDS = [
  // metadata-checks.ts
  'title-missing',
  'title-too-short',
  'title-too-long',
  'description-missing',
  'description-too-short',
  'description-too-long',
  'og-image-missing',
  'og-image-broken',
  'og-title-missing',
  'og-description-missing',
  'viewport-missing',
  'lang-missing',
  'canonical-missing',
  'robots-blocks-indexing',
  'favicon-missing',
  // performance.ts
  'perf-score-critical',
  'perf-score-poor',
  'lcp-critical',
  'lcp-poor',
  'cls-critical',
  'cls-poor',
  'render-blocking',
  'unused-js-large',
  'unused-css-large',
  'unoptimized-images',
  'inp-critical',
  'inp-poor',
  // accessibility.ts
  'images-missing-alt',
  'images-empty-alt',
  'form-inputs-no-label',
  'buttons-no-text',
  'links-no-text',
  'iframe-no-title',
  'tabindex-positive',
  'color-contrast-poor',
  'skip-link-missing',
  'keyboard-nav-trap',
  'focus-visible-missing',
  // seo.ts
  'h1-missing',
  'h1-multiple',
  'no-structured-data',
  'external-links-unsafe',
  'sitemap-missing',
  'robots-txt-missing',
  'broken-internal-links',
  'broken-page-anchors',
  // trust.ts
  'no-https',
  'no-privacy-policy',
  'no-contact-info',
  'cookie-consent-absent',
  'console-errors-critical',
  'console-errors-some',
  // mobile.ts
  'mobile-perf-critical',
  'mobile-perf-poor',
  'tap-targets-small',
  'mobile-lcp-critical',
  // content.ts
  'h1-generic',
  'no-cta-detected',
  'heading-hierarchy-missing',
  // layout.ts
  'cta-below-fold-mobile',
  // interaction.ts
  'loading-indicator-stuck',
  // design-language.ts
  'font-family-sprawl',
  'button-radius-inconsistent',
  // slop.ts
  'placeholder-copy-detected',
  'template-default-copy',
  'unreplaced-template-token',
  'cta-dead-link',
  'social-proof-unverifiable',
  // flow.ts
  'flow-no-cta-found',
  'flow-cta-unclickable',
  'flow-cta-404',
  'flow-cta-dead-end',
  'flow-cta-external-leave',
] as const

export type CheckId = (typeof ALL_CHECK_IDS)[number]

export const CHECK_ID_COUNT = ALL_CHECK_IDS.length
