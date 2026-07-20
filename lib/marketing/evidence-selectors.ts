export type EvidenceDevice = 'desktop' | 'mobile'

export interface EvidenceSelectorEntry {
  device: EvidenceDevice | 'both'
  selectors: string[]
}

/** CSS selector registry for deterministic checks. First match wins per viewport. */
export const EVIDENCE_SELECTORS: Record<string, EvidenceSelectorEntry> = {
  // Message / content
  'h1-missing': { device: 'both', selectors: ['main', 'body'] },
  'h1-multiple': { device: 'both', selectors: ['h1', 'main h1'] },
  'h1-generic': { device: 'both', selectors: ['main h1', 'h1'] },
  'no-cta-detected': {
    device: 'both',
    selectors: [
      'main a[class*="cta" i]',
      'main button[type="submit"]',
      'main section:first-of-type a[href]',
      'main a.btn',
      'main button',
      '.demo-cta-primary',
      'main a.demo-cta-primary',
      '#audit',
      'main form',
      'main a[href]',
    ],
  },

  // Metadata: invisible in DOM; pin hero / share-relevant content
  'title-missing': { device: 'both', selectors: ['main h1', 'h1', '#audit'] },
  'title-too-short': { device: 'both', selectors: ['main h1', 'h1'] },
  'title-too-long': { device: 'both', selectors: ['main h1', 'h1'] },
  'description-missing': { device: 'both', selectors: ['main h1', 'main p', '.demo-hero p', '#audit'] },
  'description-too-short': { device: 'both', selectors: ['main h1', 'main p'] },
  'description-too-long': { device: 'both', selectors: ['main h1', 'main p'] },
  'og-image-missing': {
    device: 'both',
    selectors: ['main h1', '.demo-hero', 'main section.demo-hero', '#audit'],
  },
  'og-title-missing': { device: 'both', selectors: ['main h1', 'h1'] },
  'og-description-missing': { device: 'both', selectors: ['main h1', 'main p'] },
  'og-image-broken': { device: 'both', selectors: ['main h1', '.demo-hero', '#audit'] },
  'viewport-missing': { device: 'both', selectors: ['main', 'body'] },
  'lang-missing': { device: 'both', selectors: ['main h1', 'h1'] },
  'canonical-missing': { device: 'both', selectors: ['main h1', 'h1'] },
  'robots-blocks-indexing': { device: 'both', selectors: ['main h1', 'h1'] },
  'favicon-missing': { device: 'both', selectors: ['header', '.demo-header', 'nav'] },

  // Flow / CTA
  'cta-below-fold-mobile': {
    device: 'mobile',
    selectors: [
      'main a[class*="cta" i]',
      'main button[type="submit"]',
      'main section:first-of-type a[href]',
      'main a.btn',
      'main button:not(header button):not(nav button)',
      '.demo-cta-primary',
      'main a.demo-cta-primary',
      '.demo-hero-copy a',
      'main .demo-cta-primary',
    ],
  },
  'flow-no-cta-found': {
    device: 'both',
    selectors: [
      'main section:first-of-type a[href]',
      'main h1 ~ * a[href]',
      'main h1 ~ * button',
      '.demo-cta-primary',
      'main a.demo-cta-primary',
      '#audit',
      'main form button',
    ],
  },
  'flow-cta-unclickable': {
    device: 'both',
    selectors: [
      'main section:first-of-type a[href]',
      'main h1 ~ * button',
      '.demo-cta-primary',
      '#audit',
      'main form button',
    ],
  },
  'flow-cta-404': {
    device: 'both',
    selectors: [
      'main section:first-of-type a[href]',
      '.demo-cta-primary',
      '#audit',
      'main form button',
    ],
  },
  'flow-cta-dead-end': {
    device: 'both',
    selectors: [
      'main section:first-of-type a[href]',
      'main h1 ~ * a[href]',
      'main h1 ~ * button',
      '.demo-cta-primary',
      '#audit',
      'main form button',
    ],
  },
  'flow-cta-external-leave': {
    device: 'both',
    selectors: [
      'main section:first-of-type a[href]',
      '.demo-cta-primary',
      '#audit',
      'main form button',
    ],
  },
  'flow-pricing-nav-broken': {
    device: 'both',
    selectors: ['header nav a', 'nav[aria-label] a', '.demo-nav a', 'nav a[href*="pricing" i]'],
  },
  'flow-mobile-menu-broken': {
    device: 'mobile',
    selectors: [
      'header button',
      'button[aria-label*="menu" i]',
      'button[aria-expanded]',
      'header nav',
      '.demo-nav',
    ],
  },
  'flow-form-no-validation': {
    device: 'both',
    selectors: ['main form', 'form button[type="submit"]', '#audit form', 'main input[type="email"]', 'form select'],
  },
  'form-missing-validation': {
    device: 'both',
    selectors: ['main form', 'form input', 'form textarea', 'form select', '#audit form'],
  },
  'flow-cta-blank-destination': {
    device: 'both',
    selectors: ['main', 'main h1', '.demo-cta-primary', '#signup'],
  },
  'flow-cta-stuck-loading': {
    device: 'both',
    selectors: ['main', '[aria-busy="true"]', '[class*="skeleton" i]', '[class*="loading" i]'],
  },
  'loading-state-slow': {
    device: 'both',
    selectors: ['[aria-busy="true"]', '[class*="skeleton" i]', '[class*="spinner" i]', '[class*="loading" i]', 'main h1', 'main'],
  },
  'scroll-ghost-sections': {
    device: 'both',
    selectors: ['main section', '.demo-feature-card', '#features'],
  },
  'flow-form-slow-feedback': {
    device: 'both',
    selectors: ['main form', 'form button[type="submit"]', '[role="alert"]'],
  },
  'form-inputs-zoom-mobile': {
    device: 'mobile',
    selectors: ['main input', 'main textarea', 'main select', 'form input'],
  },
  'flow-cta-destination-no-trust': {
    device: 'both',
    selectors: ['main', 'footer', 'form'],
  },
  'slow-3g-blank-screen': {
    device: 'mobile',
    selectors: ['main h1', '.demo-hero', 'main'],
  },
  'slow-3g-cta-delayed': {
    device: 'mobile',
    selectors: ['.demo-cta-primary', 'main a', 'main button'],
  },
  'cta-dead-link': { device: 'both', selectors: ['nav a', '.demo-nav a', 'main a[href]', '#audit'] },

  // Experience / mobile
  'mobile-perf-critical': { device: 'mobile', selectors: ['main h1', '.demo-hero', 'main'] },
  'mobile-perf-poor': { device: 'mobile', selectors: ['main h1', '.demo-hero'] },
  'tap-targets-small': {
    device: 'mobile',
    selectors: ['.demo-nav a', 'nav.demo-nav a', '.demo-announcement', 'header nav a', '#audit', 'main a', 'main button'],
  },
  'mobile-lcp-critical': { device: 'mobile', selectors: ['main h1', '.demo-hero-image-wrap img', 'main img'] },

  // Performance (desktop-first)
  'perf-score-critical': { device: 'desktop', selectors: ['main h1', '.demo-hero', 'main'] },
  'perf-score-poor': { device: 'desktop', selectors: ['main h1', '.demo-hero'] },
  'lcp-critical': { device: 'both', selectors: ['main h1', '.demo-hero-image-wrap img', 'main img'] },
  'lcp-poor': { device: 'both', selectors: ['main h1', '.demo-hero'] },
  'cls-critical': { device: 'both', selectors: ['main h1', 'main'] },
  'cls-poor': { device: 'both', selectors: ['main h1', 'main'] },
  'render-blocking': { device: 'both', selectors: ['main h1', '.demo-hero'] },
  'unused-js-large': { device: 'both', selectors: ['main'] },
  'unused-css-large': { device: 'both', selectors: ['main'] },
  'unoptimized-images': { device: 'both', selectors: ['main img', 'main'] },
  'inp-critical': { device: 'both', selectors: ['.demo-cta-primary', 'main button', 'main a', '#audit'] },
  'inp-poor': { device: 'both', selectors: ['.demo-cta-primary', 'main button', '#audit'] },

  // SEO
  'no-structured-data': { device: 'both', selectors: ['main h1', 'main'] },
  'external-links-unsafe': { device: 'both', selectors: ['footer a', 'main a[href^="http"]'] },
  'sitemap-missing': { device: 'both', selectors: ['main h1', 'main'] },
  'robots-txt-missing': { device: 'both', selectors: ['main h1', 'main'] },
  'broken-internal-links': { device: 'both', selectors: ['main a', 'nav a', '.demo-nav a'] },

  // Trust
  'no-https': { device: 'both', selectors: ['main', 'body'] },
  'no-privacy-policy': { device: 'both', selectors: ['footer', '.demo-footer', 'footer a'] },
  'no-contact-info': { device: 'both', selectors: ['footer', '.demo-footer', 'footer a'] },
  'cookie-consent-absent': { device: 'both', selectors: ['body', 'main'] },
  'console-errors-critical': { device: 'both', selectors: ['main h1', '.demo-hero'] },
  'console-errors-some': { device: 'both', selectors: ['main h1', '.demo-hero'] },

  // Accessibility
  'images-missing-alt': { device: 'both', selectors: ['main img', 'img'] },
  'images-empty-alt': { device: 'both', selectors: ['main img', 'img'] },
  'form-inputs-no-label': { device: 'both', selectors: ['#audit input', 'main input', 'form input'] },
  'buttons-no-text': { device: 'both', selectors: ['main button', '#audit button'] },
  'links-no-text': { device: 'both', selectors: ['main a', 'nav a', '.demo-nav a'] },
  'iframe-no-title': { device: 'both', selectors: ['iframe', 'main'] },
  'tabindex-positive': { device: 'both', selectors: ['main a', 'main button'] },
  'color-contrast-poor': { device: 'both', selectors: ['main h1', 'main p', 'main a'] },
  'skip-link-missing': { device: 'both', selectors: ['header', '.demo-header', 'nav', 'main h1'] },
  'keyboard-nav-trap': { device: 'both', selectors: ['#audit', 'main form'] },
  'focus-visible-missing': { device: 'both', selectors: ['.demo-cta-primary', 'main a', 'main button', '#audit'] },

  // Slop
  'placeholder-copy-detected': { device: 'both', selectors: ['main h1', 'main p'] },
  'template-default-copy': { device: 'both', selectors: ['main h1', 'main p'] },
  'unreplaced-template-token': { device: 'both', selectors: ['main h1', 'main p', 'main'] },
  'visual-typography-sprawl': { device: 'both', selectors: ['main h1', 'main p', 'main button'] },
  'visual-radius-inconsistent': { device: 'both', selectors: ['main a[href]', 'main button', '.demo-cta-primary'] },
  'motion-ignores-reduced-preference': {
    device: 'both',
    selectors: ['main h1', '.demo-hero', 'main section:first-of-type', '[class*="animate" i]'],
  },
}

export { METADATA_CHECK_IDS } from '@/lib/marketing/evidence-regions'

export function getEvidenceSelectors(checkId: string): EvidenceSelectorEntry | undefined {
  return EVIDENCE_SELECTORS[checkId]
}

export function devicesForCheck(checkId: string): EvidenceDevice[] {
  const entry = EVIDENCE_SELECTORS[checkId]
  if (entry) {
    if (entry.device === 'both') return ['desktop', 'mobile']
    return [entry.device]
  }
  // Unregistered: infer from check id. Never default to both: that shows a
  // healthy twin viewport beside the failing one.
  if (/mobile|thumb-zone|touch|375px|viewport-narrow/i.test(checkId)) {
    return ['mobile']
  }
  return ['desktop']
}
