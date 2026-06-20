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
    selectors: ['.demo-cta-primary', 'main a.demo-cta-primary', '#audit', 'main form', 'main button', 'main a[href]'],
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
    selectors: ['.demo-cta-primary', 'main a.demo-cta-primary', '.demo-hero-copy a', 'main .demo-cta-primary'],
  },
  'flow-no-cta-found': {
    device: 'both',
    selectors: ['.demo-cta-primary', 'main a.demo-cta-primary', '#audit', 'main form button', 'main a[href]'],
  },
  'flow-cta-unclickable': {
    device: 'both',
    selectors: ['.demo-cta-primary', '#audit', 'main form button', 'main button'],
  },
  'flow-cta-404': {
    device: 'both',
    selectors: ['.demo-cta-primary', '#audit', 'main form button', 'main a[href]'],
  },
  'flow-cta-dead-end': {
    device: 'both',
    selectors: ['.demo-cta-primary', '#audit', 'main form button', 'main a[href]'],
  },
  'flow-cta-external-leave': {
    device: 'both',
    selectors: ['.demo-cta-primary', '#audit', 'main form button', 'main a[href]'],
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
}

export { METADATA_CHECK_IDS } from '@/lib/marketing/evidence-regions'

export function getEvidenceSelectors(checkId: string): EvidenceSelectorEntry | undefined {
  return EVIDENCE_SELECTORS[checkId]
}

export function devicesForCheck(checkId: string): EvidenceDevice[] {
  const entry = EVIDENCE_SELECTORS[checkId]
  if (!entry) return ['desktop', 'mobile']
  if (entry.device === 'both') return ['desktop', 'mobile']
  return [entry.device]
}
