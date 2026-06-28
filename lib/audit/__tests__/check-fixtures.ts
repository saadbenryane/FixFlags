import type { PageMetadata } from '@/lib/audit/metadata'
import type { PageSpeedResult } from '@/lib/audit/pagespeed'

export { ALL_CHECK_IDS, CHECK_ID_COUNT, type CheckId } from '@/lib/audit/check-ids'

/** Healthy baseline metadata - individual tests override one field at a time. */
export function healthyMeta(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'FixFlags - Finish what your AI started',
    description:
      'Paste any public URL and get graded scores, evidence-backed findings, and copy-ready fix prompts for your AI coding agent.',
    ogTitle: 'FixFlags',
    ogDescription: 'Finish what your AI started',
    ogImage: 'https://example.com/og.png',
    canonical: 'https://example.com/',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    robots: 'index, follow',
    h1s: ['Finish what your AI started'],
    h2s: ['How it works'],
    images: [{ src: '/hero.png', alt: 'Product screenshot' }],
    imagesWithoutAlt: 0,
    imagesWithEmptyAlt: 0,
    links: [
      { href: 'https://external.com', text: 'Partner', rel: 'noopener noreferrer' },
      { href: '/pricing', text: 'Pricing', rel: null },
    ],
    externalLinksWithoutNoopener: 0,
    forms: 1,
    inputsWithoutLabel: 0,
    buttonsWithoutText: 0,
    linksWithoutText: 0,
    iframesWithoutTitle: 0,
    positiveTabindex: 0,
    ctaTexts: ['Get started free'],
    hasStructuredData: true,
    structuredDataTypes: ['WebSite'],
    hasAnalytics: true,
    hasCookieConsent: true,
    hasPrivacyPolicy: true,
    hasContactInfo: true,
    hasFavicon: true,
    hasSkipLink: true,
    navLandmarkCount: 0,
    pageText: 'QA for AI-built products.',
    jsonLd: [{ '@type': 'WebSite' }],
    elementIds: ['main-content', 'features'],
    formInputsMissingValidation: 0,
    ...overrides,
  }
}

export function healthyDesktopPs(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return {
    strategy: 'desktop',
    score: 90,
    lcp: 2000,
    cls: 0.05,
    fcp: 1200,
    tbt: 100,
    inp: 150,
    opportunities: [],
    failedAccessibilityAudits: [],
    diagnostics: {},
    raw: {},
    ...overrides,
  }
}

export function healthyMobilePs(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return {
    strategy: 'mobile',
    score: 85,
    lcp: 2500,
    cls: 0.05,
    fcp: 1500,
    tbt: 150,
    inp: 150,
    opportunities: [],
    failedAccessibilityAudits: [],
    diagnostics: {},
    raw: {},
    ...overrides,
  }
}
