import { describe, it, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { runMetadataChecks, runOgImageUrlCheck } from '@/lib/audit/checks/metadata-checks'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { runAccessibilityChecks } from '@/lib/audit/checks/accessibility'
import { runSeoChecks } from '@/lib/audit/checks/seo'
import { runTrustChecks } from '@/lib/audit/checks/trust'
import { runMobileChecks } from '@/lib/audit/checks/mobile'
import { runContentChecks } from '@/lib/audit/checks/content'
import { runSlopChecks } from '@/lib/audit/checks/slop'
import { runLayoutChecks } from '@/lib/audit/checks/layout'
import { runInteractionChecks } from '@/lib/audit/checks/interaction'
import { runCtaFocusChecks } from '@/lib/audit/checks/cta-focus'
import { runAuthCheckoutChecks } from '@/lib/audit/checks/auth-checkout'
import { runMeasurementChecks } from '@/lib/audit/checks/measurement'
import { runSecurityBasicsChecks } from '@/lib/audit/checks/security'
import { runSecurityHeaderChecks } from '@/lib/audit/checks/security-headers'
import { runVisualPolishChecks } from '@/lib/audit/checks/visual-polish'
import { runFlowChecks } from '@/lib/audit/checks/flow'
import { runSlowReplayChecks } from '@/lib/audit/checks/slow-replay'
import { runMessagingClarityChecks } from '@/lib/audit/checks/messaging-clarity'
import { runConversionFrictionChecks } from '@/lib/audit/checks/conversion-friction'
import { runTrustPsychologyChecks } from '@/lib/audit/checks/trust-psychology'
import { runVisualHierarchyChecks } from '@/lib/audit/checks/visual-hierarchy'
import { runMobileUXQualityChecks } from '@/lib/audit/checks/mobile-ux-quality'
import { computeRubricScores, runAllChecks } from '@/lib/audit/checks'
import { ALL_CHECK_IDS, CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import { allCheckIdsHaveVerificationRules } from '@/lib/audit/verify-flags'
import type { PageLoadExperience } from '@/lib/audit/capture-metrics'
import {
  healthyDesktopPs,
  healthyMeta,
  healthyMobilePs,
} from '@/lib/audit/__tests__/check-fixtures'

function checkIds(findings: Array<{ checkId: string }>): string[] {
  return findings.map((f) => f.checkId)
}

function mockFetchHead(responses: Record<string, number>) {
  const original = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    for (const [path, status] of Object.entries(responses)) {
      if (url.includes(path)) {
        return new Response(null, { status })
      }
    }
    return new Response(null, { status: 200 })
  }) as typeof fetch
  return () => {
    globalThis.fetch = original
  }
}

describe('audit check registry', () => {
  it('documents all deterministic checkIds', () => {
    assert.equal(ALL_CHECK_IDS.length, CHECK_ID_COUNT)
    assert.equal(new Set(ALL_CHECK_IDS).size, CHECK_ID_COUNT)
  })

  it('every checkId has a verification rule', () => {
    assert.ok(allCheckIdsHaveVerificationRules())
  })
})

describe('runMetadataChecks', () => {
  it('flags missing and malformed title tags', () => {
    assert.ok(checkIds(runMetadataChecks(healthyMeta({ title: null }))).includes('title-missing'))
    assert.ok(checkIds(runMetadataChecks(healthyMeta({ title: 'Short' }))).includes('title-too-short'))
    assert.ok(
      checkIds(
        runMetadataChecks(
          healthyMeta({ title: 'A'.repeat(61) })
        )
      ).includes('title-too-long')
    )
  })

  it('flags missing and malformed meta descriptions', () => {
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ description: null }))).includes('description-missing')
    )
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ description: 'Too short' }))).includes(
        'description-too-short'
      )
    )
    assert.ok(
      checkIds(
        runMetadataChecks(healthyMeta({ description: 'A'.repeat(161) }))
      ).includes('description-too-long')
    )
  })

  it('flags missing og tags, viewport, lang, and canonical', () => {
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ ogImage: null }))).includes('og-image-missing')
    )
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ ogTitle: null }))).includes('og-title-missing')
    )
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ ogDescription: null }))).includes(
        'og-description-missing'
      )
    )
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ viewport: null }))).includes('viewport-missing')
    )
    assert.ok(checkIds(runMetadataChecks(healthyMeta({ lang: null }))).includes('lang-missing'))
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ canonical: null }))).includes('canonical-missing')
    )
  })

  it('flags noindex robots', () => {
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ robots: 'noindex, nofollow' }))).includes(
        'robots-blocks-indexing'
      )
    )
  })

  it('flags missing favicon', () => {
    assert.ok(
      checkIds(runMetadataChecks(healthyMeta({ hasFavicon: false }))).includes('favicon-missing')
    )
  })

  it('passes a healthy page', () => {
    assert.equal(runMetadataChecks(healthyMeta()).length, 0)
  })
})

describe('runPerformanceChecks', () => {
  it('flags poor and critical performance scores', () => {
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ score: 40 }), null)).includes(
        'perf-score-critical'
      )
    )
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ score: 60 }), null)).includes('perf-score-poor')
    )
  })

  it('flags LCP and CLS thresholds', () => {
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ lcp: 4500 }), null)).includes('lcp-critical')
    )
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ lcp: 3000 }), null)).includes('lcp-poor')
    )
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ cls: 0.3 }), null)).includes('cls-critical')
    )
    assert.ok(
      checkIds(runPerformanceChecks(healthyDesktopPs({ cls: 0.15 }), null)).includes('cls-poor')
    )
  })

  it('flags Lighthouse opportunity audits above savings thresholds', () => {
    const desktop = healthyDesktopPs({
      opportunities: [
        { id: 'render-blocking-resources', title: 'Render blocking', savings: 600 },
        { id: 'unused-javascript', title: 'Unused JS', savings: 150_000 },
        { id: 'unused-css-rules', title: 'Unused CSS', savings: 60_000 },
        { id: 'uses-optimized-images', title: 'Images', savings: 60_000 },
      ],
    })
    const ids = checkIds(runPerformanceChecks(desktop, null))
    assert.ok(ids.includes('render-blocking'))
    assert.ok(ids.includes('unused-js-large'))
    assert.ok(ids.includes('unused-css-large'))
    assert.ok(ids.includes('unoptimized-images'))
  })

  it('flags INP thresholds from mobile PageSpeed', () => {
    assert.ok(
      checkIds(runPerformanceChecks(null, healthyMobilePs({ inp: 600 }))).includes('inp-critical')
    )
    assert.ok(
      checkIds(runPerformanceChecks(null, healthyMobilePs({ inp: 300 }))).includes('inp-poor')
    )
  })

  it('passes healthy desktop metrics', () => {
    assert.equal(runPerformanceChecks(healthyDesktopPs(), null).length, 0)
  })
})

describe('runAccessibilityChecks', () => {
  it('flags alt, label, and accessible-name issues', () => {
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ imagesWithoutAlt: 2 }), null)).includes(
        'images-missing-alt'
      )
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ imagesWithEmptyAlt: 4 }), null)).includes(
        'images-empty-alt'
      )
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ inputsWithoutLabel: 1 }), null)).includes(
        'form-inputs-no-label'
      )
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ buttonsWithoutText: 1 }), null)).includes(
        'buttons-no-text'
      )
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ linksWithoutText: 1 }), null)).includes('links-no-text')
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ iframesWithoutTitle: 1 }), null)).includes(
        'iframe-no-title'
      )
    )
    assert.ok(
      checkIds(runAccessibilityChecks(healthyMeta({ positiveTabindex: 1 }), null)).includes(
        'tabindex-positive'
      )
    )
  })

  it('flags Lighthouse accessibility audit failures', () => {
    const ps = healthyDesktopPs({
      failedAccessibilityAudits: [
        { id: 'color-contrast', title: 'Contrast', score: 0 },
        { id: 'bypass', title: 'Bypass', score: 0 },
        { id: 'focus-traps', title: 'Focus traps', score: 0 },
        { id: 'focus-visible', title: 'Focus visible', score: 0 },
      ],
    })
    const ids = checkIds(runAccessibilityChecks(healthyMeta(), ps))
    assert.ok(ids.includes('color-contrast-poor'))
    assert.ok(ids.includes('skip-link-missing'))
    assert.ok(ids.includes('keyboard-nav-trap'))
    assert.ok(ids.includes('focus-visible-missing'))
  })

  it('flags missing skip link when nav exists', () => {
    assert.ok(
      checkIds(
        runAccessibilityChecks(
          healthyMeta({ hasSkipLink: false, navLandmarkCount: 1 }),
          null
        )
      ).includes('skip-link-missing')
    )
  })

  it('passes a healthy page', () => {
    assert.equal(runAccessibilityChecks(healthyMeta(), null).length, 0)
  })
})

describe('runSeoChecks', () => {
  let restoreFetch: (() => void) | undefined

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = undefined
  })

  it('flags heading and structured-data issues', async () => {
    assert.ok(
      checkIds(await runSeoChecks('https://example.com', healthyMeta({ h1s: [] }))).includes(
        'h1-missing'
      )
    )
    assert.ok(
      checkIds(
        await runSeoChecks('https://example.com', healthyMeta({ h1s: ['One', 'Two'] }))
      ).includes('h1-multiple')
    )
    assert.ok(
      checkIds(
        await runSeoChecks('https://example.com', healthyMeta({ hasStructuredData: false }))
      ).includes('no-structured-data')
    )
  })

  it('flags unsafe external links', async () => {
    assert.ok(
      checkIds(
        await runSeoChecks('https://example.com', healthyMeta({ externalLinksWithoutNoopener: 2 }))
      ).includes('external-links-unsafe')
    )
  })

  it('flags missing sitemap.xml and robots.txt', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 404, 'robots.txt': 404 })
    const ids = checkIds(await runSeoChecks('https://example.com', healthyMeta()))
    assert.ok(ids.includes('sitemap-missing'))
    assert.ok(ids.includes('robots-txt-missing'))
  })

  it('flags broken internal links', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 200, '/pricing': 404 })
    const ids = checkIds(
      await runSeoChecks(
        'https://example.com',
        healthyMeta({
          links: [{ href: '/pricing', text: 'Pricing', rel: null }],
        })
      )
    )
    assert.ok(ids.includes('broken-internal-links'))
  })

  it('passes when sitemap and robots exist', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 200 })
    assert.equal((await runSeoChecks('https://example.com', healthyMeta())).length, 0)
  })

  it('does not flag a link as broken when the server rejects HEAD but GET succeeds', async () => {
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('sitemap.xml') || url.includes('robots.txt')) {
        return new Response(null, { status: 200 })
      }
      if (url.includes('/pricing')) {
        return new Response(null, { status: init?.method === 'HEAD' ? 405 : 200 })
      }
      return new Response(null, { status: 200 })
    }) as typeof fetch
    restoreFetch = () => {
      globalThis.fetch = original
    }

    const ids = checkIds(
      await runSeoChecks(
        'https://example.com',
        healthyMeta({
          links: [{ href: '/pricing', text: 'Pricing', rel: null }],
        })
      )
    )
    assert.ok(!ids.includes('broken-internal-links'))
  })

  it('falls back to GET and still flags a link as broken when a server rejects HEAD entirely', async () => {
    // Regression test: some servers return 405 for HEAD on every route regardless
    // of whether the resource exists. Without a GET fallback, a genuinely dead
    // link on such a server was silently passed as fine (false negative).
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('sitemap.xml') || url.includes('robots.txt')) {
        return new Response(null, { status: 200 })
      }
      if (url.includes('/missing')) {
        return new Response(null, { status: init?.method === 'HEAD' ? 405 : 404 })
      }
      return new Response(null, { status: 200 })
    }) as typeof fetch
    restoreFetch = () => {
      globalThis.fetch = original
    }

    const ids = checkIds(
      await runSeoChecks(
        'https://example.com',
        healthyMeta({
          links: [{ href: '/missing', text: 'Missing', rel: null }],
        })
      )
    )
    assert.ok(ids.includes('broken-internal-links'))
  })

  it('does not flag a link as broken on a transient network error', async () => {
    // Regression test: a fetch exception (timeout, DNS hiccup, anti-bot block
    // against the scanner itself) isn't evidence the link is dead for a real
    // visitor. Matches the established, documented behavior in auth-checkout.ts.
    const original = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('sitemap.xml') || url.includes('robots.txt')) {
        return new Response(null, { status: 200 })
      }
      throw new Error('network error')
    }) as typeof fetch
    restoreFetch = () => {
      globalThis.fetch = original
    }

    const ids = checkIds(
      await runSeoChecks(
        'https://example.com',
        healthyMeta({
          links: [{ href: '/flaky', text: 'Flaky', rel: null }],
        })
      )
    )
    assert.ok(!ids.includes('broken-internal-links'))
  })
})

describe('runTrustChecks', () => {
  it('flags HTTP, missing legal/contact info, and cookie consent gaps', () => {
    assert.ok(
      checkIds(runTrustChecks('http://example.com', healthyMeta(), [])).includes('no-https')
    )
    assert.ok(
      checkIds(runTrustChecks('https://example.com', healthyMeta({ hasPrivacyPolicy: false }), [])).includes(
        'no-privacy-policy'
      )
    )
    assert.ok(
      checkIds(runTrustChecks('https://example.com', healthyMeta({ hasContactInfo: false }), [])).includes(
        'no-contact-info'
      )
    )
    assert.ok(
      checkIds(
        runTrustChecks(
          'https://example.com',
          healthyMeta({ hasAnalytics: true, hasCookieConsent: false }),
          []
        )
      ).includes('cookie-consent-absent')
    )
  })

  it('flags console errors by severity', () => {
    const one = [{ type: 'error', text: 'TypeError: x is not a function' }]
    const many = Array.from({ length: 3 }, (_, i) => ({
      type: 'error',
      text: `Error ${i}`,
    }))
    assert.ok(
      checkIds(runTrustChecks('https://example.com', healthyMeta(), one)).includes(
        'console-errors-some'
      )
    )
    assert.ok(
      checkIds(runTrustChecks('https://example.com', healthyMeta(), many)).includes(
        'console-errors-critical'
      )
    )
  })

  it('passes a healthy HTTPS page', () => {
    assert.equal(runTrustChecks('https://example.com', healthyMeta(), []).length, 0)
  })
})

describe('runSecurityHeaderChecks', () => {
  it('flags missing CSP header', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {})
      ).includes('security-csp-missing')
    )
  })

  it('flags unsafe-inline in CSP script-src', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {
          'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'",
        })
      ).includes('security-csp-unsafe-inline')
    )
  })

  it('does not flag unsafe-inline when CSP has nonce', () => {
    assert.equal(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {
          'content-security-policy': "default-src 'self'; script-src 'self' 'nonce-abc123'",
        })
      ).includes('security-csp-unsafe-inline'),
      false
    )
  })

  it('flags missing HSTS on HTTPS', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {})
      ).includes('security-hsts-missing')
    )
  })

  it('flags short HSTS max-age', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {
          'strict-transport-security': 'max-age=86400',
        })
      ).includes('security-hsts-too-short')
    )
  })

  it('flags missing X-Frame-Options when no CSP frame-ancestors', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {})
      ).includes('security-frame-options-missing')
    )
  })

  it('skips X-Frame-Options check when CSP has frame-ancestors', () => {
    assert.equal(
      runSecurityHeaderChecks('https://example.com', {
        'content-security-policy': "frame-ancestors 'self'",
      }).filter((f) => f.checkId.startsWith('security-frame-options')).length,
      0
    )
  })

  it('flags permissive X-Frame-Options', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {
          'x-frame-options': 'ALLOWALL',
        })
      ).includes('security-frame-options-too-permissive')
    )
  })

  it('flags missing X-Content-Type-Options', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {})
      ).includes('security-content-type-options-missing')
    )
  })

  it('flags missing X-XSS-Protection', () => {
    assert.ok(
      checkIds(
        runSecurityHeaderChecks('https://example.com', {})
      ).includes('security-xss-protection-missing')
    )
  })

  it('passes with all security headers present', () => {
    assert.equal(
      runSecurityHeaderChecks('https://example.com', {
        'content-security-policy': "default-src 'self'",
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
        'x-xss-protection': '1; mode=block',
      }).length,
      0
    )
  })

  it('returns no findings when responseHeaders is null (skipCapture path)', () => {
    assert.equal(runSecurityHeaderChecks('https://example.com', null).length, 0)
  })
})

describe('runSecurityBasicsChecks', () => {
  it('flags an HTTPS page that loads an image over HTTP', () => {
    assert.ok(
      checkIds(
        runSecurityBasicsChecks(
          'https://example.com',
          healthyMeta({ images: [{ src: 'http://cdn.example.com/img.png', alt: 'x' }] })
        )
      ).includes('security-mixed-content')
    )
  })

  it('does not flag a plain outbound link to an HTTP site as mixed content', () => {
    // Regression test: a real bug flagged CRITICAL "mixed content" whenever the
    // page had ANY <a href="http://..."> link, even though clicking a link just
    // navigates away -- it doesn't load a resource insecurely, so browsers never
    // warn or block on it. Only actual subresource loads (images, scripts,
    // stylesheets) count as mixed content.
    assert.equal(
      runSecurityBasicsChecks(
        'https://example.com',
        healthyMeta({
          links: [{ href: 'http://old-docs.example.com/reference', text: 'Reference', rel: null }],
        })
      ).length,
      0
    )
  })
})

describe('runMobileChecks', () => {
  it('flags poor mobile performance and tap targets', () => {
    assert.ok(
      checkIds(runMobileChecks(healthyMobilePs({ score: 40 }))).includes('mobile-perf-critical')
    )
    assert.ok(checkIds(runMobileChecks(healthyMobilePs({ score: 60 }))).includes('mobile-perf-poor'))
    assert.ok(
      checkIds(
        runMobileChecks(
          healthyMobilePs({
            opportunities: [{ id: 'tap-targets', title: 'Tap targets', savings: 0 }],
          })
        )
      ).includes('tap-targets-small')
    )
    assert.ok(
      checkIds(runMobileChecks(healthyMobilePs({ lcp: 4500 }))).includes('mobile-lcp-critical')
    )
  })

  it('passes healthy mobile metrics', () => {
    assert.equal(runMobileChecks(healthyMobilePs()).length, 0)
  })
})

describe('runContentChecks', () => {
  it('flags generic H1 and missing CTAs', () => {
    assert.ok(
      checkIds(runContentChecks(healthyMeta({ h1s: ['Welcome to our site'] }))).includes('h1-generic')
    )
    assert.ok(
      checkIds(runContentChecks(healthyMeta({ h1s: ['Build something amazing with AI'] }))).includes(
        'h1-generic'
      )
    )
    assert.ok(
      checkIds(runContentChecks(healthyMeta({ ctaTexts: [] }))).includes('no-cta-detected')
    )
  })

  it('passes descriptive H1 with CTA', () => {
    assert.equal(runContentChecks(healthyMeta()).length, 0)
  })
})

function healthyCaptureMetrics(
  overrides: Partial<{
    mobilePrimaryCtaTopPx: number | null
    mobilePrimaryCtaText: string | null
    competingPrimaryCtaCount: number
    competingPrimaryCtaLabels: string[]
    mobileViewportHeight: number
    stuckLoadingIndicator: boolean
    stuckLoadingLabel: string | null
    uniqueFontFamilies: number
    fontFamilySample: string[]
    buttonBorderRadii: number[]
    motionIgnoresReducedPreference: boolean
    motionSampleLabel: string | null
    inputsBelow16px: Array<{ selector: string; fontSize: number }>
    loadExperience: PageLoadExperience | null
  }> = {}
) {
  return {
    mobilePrimaryCtaTopPx: 400,
    mobilePrimaryCtaText: 'Get started',
    competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started'],
    mobileViewportHeight: 812,
    stuckLoadingIndicator: false,
    stuckLoadingLabel: null,
    uniqueFontFamilies: 2,
    fontFamilySample: ['Inter', 'Georgia'],
    buttonBorderRadii: [8],
    motionIgnoresReducedPreference: false,
    motionSampleLabel: null,
    inputsBelow16px: [],
    loadExperience: null,
    ...overrides,
  }
}

describe('runLayoutChecks', () => {
  it('flags primary CTA below the mobile fold', () => {
    assert.ok(
      checkIds(
        runLayoutChecks(
          healthyCaptureMetrics({
            mobilePrimaryCtaTopPx: 720,
            mobilePrimaryCtaText: 'Get started',
          })
        )
      ).includes('cta-below-fold-mobile')
    )
  })

  it('passes when CTA is above the fold', () => {
    assert.equal(
      runLayoutChecks(
        healthyCaptureMetrics({
          mobilePrimaryCtaTopPx: 400,
          mobilePrimaryCtaText: 'Get started',
        })
      ).length,
      0
    )
  })
})

describe('runInteractionChecks', () => {
  it('flags stuck loading UI at capture', () => {
    assert.ok(
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            stuckLoadingIndicator: true,
            stuckLoadingLabel: 'skeleton',
          })
        )
      ).includes('loading-indicator-stuck')
    )
  })

  it('passes when no loading UI is stuck', () => {
    assert.equal(runInteractionChecks(healthyCaptureMetrics()).length, 0)
  })

  it('flags loading UI that clears slowly', () => {
    assert.ok(
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            loadExperience: {
              device: 'mobile',
              initialScreenshotUrl: '/api/screenshots/audit/mobile?page=p0-initial',
              initialCaptureElapsedMs: 700,
              finalCaptureElapsedMs: 4600,
              loadingVisibleAtInitial: true,
              loadingVisibleAtFinal: false,
              loadingClearedMs: 4200,
              loadingLabel: 'hero-skeleton',
              finalReadyState: 'complete',
              finalTitle: 'Loaded product page',
            },
          })
        )
      ).includes('loading-state-slow')
    )
  })

  it('flags motion that ignores prefers-reduced-motion', () => {
    assert.ok(
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            motionIgnoresReducedPreference: true,
            motionSampleLabel: 'hero-fade',
          })
        )
      ).includes('motion-ignores-reduced-preference')
    )
  })
})

describe('runAllChecks', () => {
  let restoreFetch: (() => void) | undefined

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = undefined
  })

  it('deduplicates findings by checkId', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 200 })
    const { flags: findings } = await runAllChecks(
      'https://example.com',
      healthyMeta({ title: null }),
      healthyDesktopPs(),
      healthyMobilePs(),
      []
    )
    const titleFindings = findings.filter((f) => f.checkId === 'title-missing')
    assert.equal(titleFindings.length, 1)
  })

  it('returns only registry checkIds', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 404, 'robots.txt': 404 })
    const { flags: findings } = await runAllChecks(
      'https://example.com',
      healthyMeta({
        title: null,
        description: null,
        ogImage: null,
        h1s: [],
        ctaTexts: [],
        hasPrivacyPolicy: false,
      }),
      healthyDesktopPs({ score: 40, lcp: 5000, cls: 0.3 }),
      healthyMobilePs({ score: 40, lcp: 5000 }),
      [{ type: 'error', text: 'boom' }]
    )
    for (const finding of findings) {
      assert.ok(
        (ALL_CHECK_IDS as readonly string[]).includes(finding.checkId),
        `unexpected checkId: ${finding.checkId}`
      )
    }
  })

  it('runs CTA focus and auth/checkout checks in the production pipeline', async () => {
    restoreFetch = mockFetchHead({ '/checkout': 404, 'sitemap.xml': 200, 'robots.txt': 200 })
    const { flags } = await runAllChecks(
      'https://example.com',
      healthyMeta({
        links: [{ href: '/checkout', text: 'Subscribe', rel: null }],
      }),
      healthyDesktopPs(),
      healthyMobilePs(),
      [],
      undefined,
      healthyCaptureMetrics({
        competingPrimaryCtaCount: 3,
        competingPrimaryCtaLabels: ['Get started', 'Book a demo', 'Subscribe'],
      })
    )
    const ids = checkIds(flags)
    assert.ok(ids.includes('competing-ctas'))
    assert.ok(!ids.includes('hierarchy-competing-actions'))
    assert.ok(ids.includes('checkout-link-dead'))
  })

  it('suppresses older contact-info flag when direct-contact trust flag is present', async () => {
    restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 200 })
    const { flags } = await runAllChecks(
      'https://example.com',
      healthyMeta({
        hasContactInfo: false,
        ctaTexts: ['Get started'],
        pageText: 'Get started with our product today.',
        links: [],
      }),
      healthyDesktopPs(),
      healthyMobilePs(),
      []
    )
    const ids = checkIds(flags)
    assert.deepEqual(
      ids.filter((id) => ['no-contact-info', 'trust-no-direct-contact'].includes(id)),
      ['trust-no-direct-contact']
    )
  })
})

describe('computeRubricScores', () => {
  it('maps PageSpeed and flag penalties to rubric scores', () => {
    const scores = computeRubricScores(
      [
        {
          checkId: 'images-missing-alt',
          rubric: 'EXPERIENCE',
          severity: 'IMPORTANT',
          problem: '',
          evidence: '',
          fix: '',
          confidence: 1,
          source: 'DETERMINISTIC',
        },
      ],
      healthyDesktopPs({ score: 88 }),
      healthyMobilePs({ score: 77 })
    )
    assert.equal(scores.EXPERIENCE, 68)
    assert.equal(scores.MESSAGE, 100)
    assert.equal(scores.REACH, 100)
  })

  it('penalizes experience when PageSpeed is unavailable', () => {
    const scores = computeRubricScores([], null, null, {
      pageSpeedAvailable: { desktop: false, mobile: false },
    })
    assert.equal(scores.EXPERIENCE, 75)
    assert.equal(scores.MESSAGE, 100)
    assert.equal(scores.REACH, 100)
  })

  it('penalizes rubrics when their check modules fail', () => {
    const scores = computeRubricScores([], null, null, {
      pageSpeedAvailable: { desktop: false, mobile: false },
      failedModules: ['content', 'seo'],
    })
    assert.equal(scores.MESSAGE, 75)
    assert.equal(scores.REACH, 75)
  })

  it('penalizes EXPERIENCE when a module that emits EXPERIENCE findings fails, even with a healthy PageSpeed score', () => {
    // Regression: trust-psychology/mobile-ux-quality/interaction/etc. all emit
    // EXPERIENCE-rubric flags, but there was no module-failure tracking for
    // EXPERIENCE at all - a crashed module silently lost its uncertainty penalty
    // whenever PageSpeed data happened to still be available.
    const scores = computeRubricScores([], healthyDesktopPs({ score: 90 }), healthyMobilePs({ score: 90 }), {
      failedModules: ['mobile-ux-quality'],
    })
    assert.equal(scores.EXPERIENCE, 65)
  })

  it('penalizes MESSAGE for trust/cta-focus/mobile-ux-quality module failures too', () => {
    // Regression: trust.ts, cta-focus.ts, and mobile-ux-quality.ts all emit
    // MESSAGE-rubric flags but weren't in MESSAGE_MODULES.
    const scores = computeRubricScores([], null, null, {
      pageSpeedAvailable: { desktop: false, mobile: false },
      failedModules: ['trust'],
    })
    assert.equal(scores.MESSAGE, 75)

    const scores2 = computeRubricScores([], null, null, {
      pageSpeedAvailable: { desktop: false, mobile: false },
      failedModules: ['cta-focus'],
    })
    assert.equal(scores2.MESSAGE, 75)
  })

  it('penalizes REACH for measurement/security/security-headers module failures too', () => {
    // Regression: measurement.ts, security.ts, and security-headers.ts all emit
    // REACH-rubric flags but weren't in REACH_MODULES.
    const scores = computeRubricScores([], null, null, {
      pageSpeedAvailable: { desktop: false, mobile: false },
      failedModules: ['security-headers'],
    })
    assert.equal(scores.REACH, 75)
  })
})

describe('trigger matrix - one failing signal per checkId', () => {
  let restoreFetch: (() => void) | undefined

  afterEach(() => {
    restoreFetch?.()
    restoreFetch = undefined
  })

  const failedA11yPs = healthyDesktopPs({
    failedAccessibilityAudits: [
      { id: 'color-contrast', title: 'Contrast', score: 0 },
      { id: 'bypass', title: 'Bypass', score: 0 },
      { id: 'focus-traps', title: 'Focus traps', score: 0 },
      { id: 'focus-visible', title: 'Focus visible', score: 0 },
    ],
  })

  const triggers: Record<(typeof ALL_CHECK_IDS)[number], () => Promise<string[]> | string[]> = {
    'title-missing': () => checkIds(runMetadataChecks(healthyMeta({ title: null }))),
    'title-too-short': () => checkIds(runMetadataChecks(healthyMeta({ title: 'Short' }))),
    'title-too-long': () =>
      checkIds(runMetadataChecks(healthyMeta({ title: 'A'.repeat(61) }))),
    'description-missing': () =>
      checkIds(runMetadataChecks(healthyMeta({ description: null }))),
    'description-too-short': () =>
      checkIds(runMetadataChecks(healthyMeta({ description: 'Too short' }))),
    'description-too-long': () =>
      checkIds(runMetadataChecks(healthyMeta({ description: 'A'.repeat(161) }))),
    'og-image-missing': () => checkIds(runMetadataChecks(healthyMeta({ ogImage: null }))),
    'og-image-broken': async () => {
      restoreFetch = mockFetchHead({ '/broken.png': 404 })
      return checkIds(
        await runOgImageUrlCheck(
          'https://example.com',
          healthyMeta({ ogImage: 'https://example.com/broken.png' })
        )
      )
    },
    'og-title-missing': () => checkIds(runMetadataChecks(healthyMeta({ ogTitle: null }))),
    'og-description-missing': () =>
      checkIds(runMetadataChecks(healthyMeta({ ogDescription: null }))),
    'viewport-missing': () => checkIds(runMetadataChecks(healthyMeta({ viewport: null }))),
    'lang-missing': () => checkIds(runMetadataChecks(healthyMeta({ lang: null }))),
    'canonical-missing': () => checkIds(runMetadataChecks(healthyMeta({ canonical: null }))),
    'robots-blocks-indexing': () =>
      checkIds(runMetadataChecks(healthyMeta({ robots: 'noindex' }))),
    'favicon-missing': () =>
      checkIds(runMetadataChecks(healthyMeta({ hasFavicon: false }))),
    'perf-score-critical': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ score: 40 }), null)),
    'perf-score-poor': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ score: 60 }), null)),
    'lcp-critical': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ lcp: 4500 }), null)),
    'lcp-poor': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ lcp: 3000 }), null)),
    'cls-critical': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ cls: 0.3 }), null)),
    'cls-poor': () =>
      checkIds(runPerformanceChecks(healthyDesktopPs({ cls: 0.15 }), null)),
    'render-blocking': () =>
      checkIds(
        runPerformanceChecks(
          healthyDesktopPs({
            opportunities: [{ id: 'render-blocking-resources', title: 'RB', savings: 600 }],
          }),
          null
        )
      ),
    'unused-js-large': () =>
      checkIds(
        runPerformanceChecks(
          healthyDesktopPs({
            opportunities: [{ id: 'unused-javascript', title: 'JS', savings: 150_000 }],
          }),
          null
        )
      ),
    'unused-css-large': () =>
      checkIds(
        runPerformanceChecks(
          healthyDesktopPs({
            opportunities: [{ id: 'unused-css-rules', title: 'CSS', savings: 60_000 }],
          }),
          null
        )
      ),
    'unoptimized-images': () =>
      checkIds(
        runPerformanceChecks(
          healthyDesktopPs({
            opportunities: [{ id: 'uses-webp-images', title: 'Images', savings: 60_000 }],
          }),
          null
        )
      ),
    'inp-critical': () =>
      checkIds(runPerformanceChecks(null, healthyMobilePs({ inp: 600 }))),
    'inp-poor': () =>
      checkIds(runPerformanceChecks(null, healthyMobilePs({ inp: 300 }))),
    'images-missing-alt': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ imagesWithoutAlt: 1 }), null)),
    'images-empty-alt': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ imagesWithEmptyAlt: 4 }), null)),
    'form-inputs-no-label': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ inputsWithoutLabel: 1 }), null)),
    'buttons-no-text': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ buttonsWithoutText: 1 }), null)),
    'links-no-text': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ linksWithoutText: 1 }), null)),
    'iframe-no-title': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ iframesWithoutTitle: 1 }), null)),
    'tabindex-positive': () =>
      checkIds(runAccessibilityChecks(healthyMeta({ positiveTabindex: 1 }), null)),
    'color-contrast-poor': () =>
      checkIds(runAccessibilityChecks(healthyMeta(), failedA11yPs)),
    'skip-link-missing': () =>
      checkIds(
        runAccessibilityChecks(
          healthyMeta({ hasSkipLink: false, navLandmarkCount: 1 }),
          null
        )
      ),
    'keyboard-nav-trap': () =>
      checkIds(runAccessibilityChecks(healthyMeta(), failedA11yPs)),
    'focus-visible-missing': () =>
      checkIds(runAccessibilityChecks(healthyMeta(), failedA11yPs)),
    'h1-missing': async () =>
      checkIds(await runSeoChecks('https://example.com', healthyMeta({ h1s: [] }))),
    'h1-multiple': async () =>
      checkIds(
        await runSeoChecks('https://example.com', healthyMeta({ h1s: ['A', 'B'] }))
      ),
    'no-structured-data': async () =>
      checkIds(
        await runSeoChecks('https://example.com', healthyMeta({ hasStructuredData: false }))
      ),
    'external-links-unsafe': async () =>
      checkIds(
        await runSeoChecks(
          'https://example.com',
          healthyMeta({ externalLinksWithoutNoopener: 1 })
        )
      ),
    'sitemap-missing': async () => {
      restoreFetch = mockFetchHead({ 'sitemap.xml': 404, 'robots.txt': 200 })
      return checkIds(await runSeoChecks('https://example.com', healthyMeta()))
    },
    'robots-txt-missing': async () => {
      restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 404 })
      return checkIds(await runSeoChecks('https://example.com', healthyMeta()))
    },
    'broken-internal-links': async () => {
      restoreFetch = mockFetchHead({ 'sitemap.xml': 200, 'robots.txt': 200, '/pricing': 404 })
      return checkIds(
        await runSeoChecks(
          'https://example.com',
          healthyMeta({
            links: [{ href: '/pricing', text: 'Pricing', rel: null }],
          })
        )
      )
    },
    'no-https': () => checkIds(runTrustChecks('http://example.com', healthyMeta(), [])),
    'no-privacy-policy': () =>
      checkIds(
        runTrustChecks('https://example.com', healthyMeta({ hasPrivacyPolicy: false }), [])
      ),
    'no-contact-info': () =>
      checkIds(
        runTrustChecks('https://example.com', healthyMeta({ hasContactInfo: false }), [])
      ),
    'cookie-consent-absent': () =>
      checkIds(
        runTrustChecks(
          'https://example.com',
          healthyMeta({ hasAnalytics: true, hasCookieConsent: false }),
          []
        )
      ),
    'console-errors-critical': () =>
      checkIds(
        runTrustChecks(
          'https://example.com',
          healthyMeta(),
          [
            { type: 'error', text: 'a' },
            { type: 'error', text: 'b' },
            { type: 'error', text: 'c' },
          ]
        )
      ),
    'console-errors-some': () =>
      checkIds(
        runTrustChecks('https://example.com', healthyMeta(), [{ type: 'error', text: 'one' }])
      ),
    'mobile-perf-critical': () =>
      checkIds(runMobileChecks(healthyMobilePs({ score: 40 }))),
    'mobile-perf-poor': () => checkIds(runMobileChecks(healthyMobilePs({ score: 60 }))),
    'tap-targets-small': () =>
      checkIds(
        runMobileChecks(
          healthyMobilePs({
            opportunities: [{ id: 'target-size', title: 'Tap targets', savings: 0 }],
          })
        )
      ),
    'mobile-lcp-critical': () =>
      checkIds(runMobileChecks(healthyMobilePs({ lcp: 4500 }))),
    'h1-generic': () =>
      checkIds(runContentChecks(healthyMeta({ h1s: ['Welcome home'] }))),
    'no-cta-detected': () =>
      checkIds(runContentChecks(healthyMeta({ ctaTexts: [] }))),
    'heading-hierarchy-missing': () =>
      checkIds(runContentChecks(healthyMeta({ h1s: ['Ship faster'], h2s: [] }))),
    'measurement-ga-gtm-posthog-missing': () =>
      checkIds(runMeasurementChecks(healthyMeta({ hasAnalytics: false }))),
    'form-missing-validation': () =>
      checkIds(runContentChecks(healthyMeta({ forms: 1, formInputsMissingValidation: 2 }))),
    'cta-below-fold-mobile': () =>
      checkIds(
        runLayoutChecks(
          healthyCaptureMetrics({
            mobilePrimaryCtaTopPx: 720,
            mobilePrimaryCtaText: 'Get started',
          })
        )
      ),
    'loading-indicator-stuck': () =>
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            stuckLoadingIndicator: true,
            stuckLoadingLabel: 'hero-skeleton',
          })
        )
      ),
    'loading-state-slow': () =>
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            loadExperience: {
              device: 'mobile',
              initialScreenshotUrl: '/api/screenshots/audit/mobile?page=p0-initial',
              initialCaptureElapsedMs: 500,
              finalCaptureElapsedMs: 5500,
              loadingVisibleAtInitial: true,
              loadingVisibleAtFinal: false,
              loadingClearedMs: 5200,
              loadingLabel: 'hero-skeleton',
              finalReadyState: 'complete',
              finalTitle: 'Loaded product page',
            },
          })
        )
      ),
    'motion-ignores-reduced-preference': () =>
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            motionIgnoresReducedPreference: true,
            motionSampleLabel: 'animate-pulse',
          })
        )
      ),
    'form-inputs-zoom-mobile': () =>
      checkIds(
        runInteractionChecks(healthyCaptureMetrics({
          inputsBelow16px: [{ selector: '#email', fontSize: 14 }],
        }))
      ),

    'competing-ctas': () =>
      checkIds(
        runCtaFocusChecks(
          healthyCaptureMetrics({
            competingPrimaryCtaCount: 3,
            competingPrimaryCtaLabels: ['Get started', 'Book a demo', 'Subscribe'],
          })
        )
      ),
    'placeholder-copy-detected': () =>
      checkIds(runSlopChecks(healthyMeta({ pageText: 'Lorem ipsum dolor sit amet.' }))),
    'template-default-copy': () =>
      checkIds(runSlopChecks(healthyMeta({ pageText: 'Welcome to our platform.' }))),
    'unreplaced-template-token': () =>
      checkIds(runSlopChecks(healthyMeta({ pageText: 'Hello {{user_name}}!' }))),
    'cta-dead-link': () =>
      checkIds(
        runSlopChecks(
          healthyMeta({
            links: [{ href: '#', text: 'Get started free', rel: null }],
          })
        )
      ),
    'social-proof-unverifiable': () =>
      checkIds(
        runSlopChecks(
          healthyMeta({ pageText: 'Trusted by 10,000+ happy customers worldwide.' })
        )
      ),
    'broken-page-anchors': async () =>
      checkIds(
        await runSeoChecks(
          'https://example.com',
          healthyMeta({
            elementIds: ['features'],
            links: [
              { href: '#pricing', text: 'Pricing', rel: null },
              { href: '#features', text: 'Features', rel: null },
            ],
          })
        )
      ),
    'measurement-consent-blocking-incomplete': () =>
      checkIds(runMeasurementChecks(healthyMeta({ hasAnalytics: true, hasCookieConsent: false }))),
    'checkout-link-dead': async () => {
      restoreFetch = mockFetchHead({ '/checkout': 404 })
      return checkIds(
        await runAuthCheckoutChecks(
          'https://example.com',
          healthyMeta({ links: [{ href: '/checkout', text: 'Subscribe', rel: null }] })
        )
      )
    },
    'auth-page-broken': async () => {
      restoreFetch = mockFetchHead({ '/login': 500 })
      return checkIds(
        await runAuthCheckoutChecks(
          'https://example.com',
          healthyMeta({ links: [{ href: '/login', text: 'Log in', rel: null }] })
        )
      )
    },
    'security-mixed-content': () =>
      checkIds(runSecurityBasicsChecks('https://example.com', healthyMeta({
        images: [{ src: '/hero.png', alt: 'Screenshot' }, { src: 'http://cdn.example.com/img.png', alt: 'Insecure image' }],
      }))),
    'security-csp-missing': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {})),
    'security-csp-unsafe-inline': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {
        'content-security-policy': "script-src 'self' 'unsafe-inline'",
      })),
    'security-hsts-missing': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {})),
    'security-hsts-too-short': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {
        'strict-transport-security': 'max-age=3600',
      })),
    'security-frame-options-missing': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {})),
    'security-frame-options-too-permissive': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {
        'x-frame-options': 'ALLOWALL',
      })),
    'security-content-type-options-missing': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {})),
    'security-xss-protection-missing': () =>
      checkIds(runSecurityHeaderChecks('https://example.com', {})),
    'visual-radius-inconsistent': () =>
      checkIds(runVisualPolishChecks(healthyCaptureMetrics({ buttonBorderRadii: [0, 8, 24] }))),
    'visual-typography-sprawl': () =>
      checkIds(runVisualPolishChecks(healthyCaptureMetrics({ uniqueFontFamilies: 6, fontFamilySample: ['Inter', 'Roboto', 'Georgia', 'Arial', 'Helvetica', 'Times'] }))),
    'flow-no-cta-found': () =>
      checkIds(runFlowChecks({ status: 'no_cta', steps: [], finalUrl: 'https://example.com' })),
    'flow-cta-unclickable': () =>
      checkIds(
        runFlowChecks({
          status: 'unclickable',
          steps: [],
          finalUrl: 'https://example.com',
          ctaText: 'Get started',
        })
      ),
    'flow-cta-404': () =>
      checkIds(
        runFlowChecks({
          status: 'error_response',
          steps: [],
          finalUrl: 'https://example.com/missing',
          ctaText: 'Get started',
          httpStatus: 404,
        })
      ),
    'flow-cta-dead-end': () =>
      checkIds(
        runFlowChecks({
          status: 'dead_end',
          steps: [],
          finalUrl: 'https://example.com',
          ctaText: 'Get started',
        })
      ),
    'flow-cta-external-leave': () =>
      checkIds(
        runFlowChecks({
          status: 'external_leave',
          steps: [],
          finalUrl: 'https://checkout.example.net',
          ctaText: 'Buy now',
        })
      ),
    'flow-pricing-nav-broken': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          multiStep: {
            pricingNav: 'broken',
            pricingNavLabel: 'Pricing',
            pricingNavHref: '#pricing',
            mobileMenu: 'skipped',
            formValidation: 'skipped',
          },
        })
      ),
    'flow-mobile-menu-broken': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          multiStep: {
            pricingNav: 'skipped',
            mobileMenu: 'broken',
            formValidation: 'skipped',
          },
        })
      ),
    'flow-form-no-validation': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          multiStep: {
            pricingNav: 'skipped',
            mobileMenu: 'skipped',
            formValidation: 'broken',
            formLabel: 'Signup form',
          },
        })
      ),
    'flow-form-slow-feedback': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          multiStep: {
            pricingNav: 'skipped',
            mobileMenu: 'skipped',
            formValidation: 'ok',
            formFeedbackMs: 1500,
          },
        })
      ),
    'scroll-ghost-sections': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          multiStep: {
            pricingNav: 'skipped',
            mobileMenu: 'skipped',
            formValidation: 'skipped',
            ghostSections: 1,
            ghostSampleSelector: 'section.features',
          },
        })
      ),
    'flow-cta-blank-destination': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          postClickMetrics: {
            timeToFirstContentMs: 4000,
            blankScreenMs: 3500,
            stuckLoading: false,
            stuckLoadingLabel: null,
          },
        })
      ),
    'flow-cta-stuck-loading': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'https://example.com/signup',
          postClickMetrics: {
            timeToFirstContentMs: 1000,
            blankScreenMs: 1000,
            stuckLoading: true,
            stuckLoadingLabel: 'skeleton',
          },
        })
      ),
    'flow-cta-destination-no-trust': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/signup',
          destinationTrust: {
            hasPrivacyPolicy: false,
            hasContactInfo: false,
            isHttps: false,
          },
        })
      ),
    'slow-3g-blank-screen': () =>
      checkIds(runSlowReplayChecks({ timeToFirstTextMs: 6000, timeToCtaMs: 1000, screenshotUrls: [] })),
    'slow-3g-cta-delayed': () =>
      checkIds(runSlowReplayChecks({ timeToFirstTextMs: 1000, timeToCtaMs: 9000, screenshotUrls: [] })),
    'flow-destination-no-headline': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          ctaText: 'Sign up',
          destinationUX: {
            hasClearHeadline: false,
            hasPrimaryCTA: true,
            headline: null,
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-destination-no-cta': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          ctaText: 'Sign up',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: false,
            headline: 'Welcome',
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 0, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-cta-message-mismatch': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          ctaText: 'Start free trial',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: true,
            headline: 'See our pricing plans',
            ctaText: null,
            ctaPromisesMatch: false,
            pageType: null,
            frictionSignals: { ctaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-destination-cta-overload': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: true,
            headline: 'Welcome',
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 5, tooManyCTAs: true, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-destination-stuck-loading': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: true,
            headline: 'Welcome',
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: true, timeToContentMs: 5000, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-destination-no-privacy': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: true,
            headline: 'Welcome',
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: true },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: false, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),
    'flow-destination-slow-load': () =>
      checkIds(
        runFlowChecks({
          status: 'success',
          steps: [],
          finalUrl: 'http://example.com/dest',
          destinationUX: {
            hasClearHeadline: true,
            hasPrimaryCTA: true,
            headline: 'Welcome',
            ctaText: null,
            ctaPromisesMatch: true,
            pageType: null,
            frictionSignals: { ctaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
            loadQuality: { hadStuckLoading: false, timeToContentMs: 3500, layoutShift: false },
            trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
            mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
          },
        })
      ),

    // messaging-clarity
    'messaging-weak-value-prop': () =>
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['Our platform is great'], h2s: [], pageText: '' }))),
    'messaging-jargon-overload': () =>
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['Leverage our disruptive ecosystem'], h2s: [], pageText: '' }))),
    'messaging-no-audience': () =>
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['Ship faster'], h2s: [], pageText: '' }))),
    'messaging-long-sentences': () =>
      checkIds(
        runMessagingClarityChecks(
          healthyMeta({
            h1s: ['Product page'],
            pageText:
              'This is a very long sentence that definitely exceeds the thirty word threshold for sentence length and should be flagged by the automated checker system right away without any delay whatsoever. ' +
              'Here is another excessively long sentence that goes way beyond the recommended word count and will be caught by our automated analysis tools and reported for review by the editorial team without fail. ' +
              'Yet one more verbose sentence that is far too long for comfortable reading and will definitely be picked up by the long sentence detection logic and flagged for immediate correction without any exceptions or special cases.',
          })
        )
      ),
    'messaging-headline-too-short': () =>
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['Go'], h2s: [], pageText: '' }))),

    // conversion-friction
    'friction-no-commitment-path': () =>
      checkIds(runConversionFrictionChecks(healthyMeta({ pageText: 'We make a product.', links: [], h1s: ['Product'], ctaTexts: [] }))),
    'friction-trial-commitment-unclear': () =>
      checkIds(runConversionFrictionChecks(healthyMeta({ pageText: 'Start your free trial today', links: [] }))),
    'friction-form-too-many-fields': () =>
      checkIds(runConversionFrictionChecks(healthyMeta({ totalFormInputs: 7 }))),
    'friction-no-risk-reversal': () =>
      checkIds(runConversionFrictionChecks(healthyMeta({ pageText: 'Sign up now for early access', ctaTexts: ['Sign up'], links: [] }))),
    'friction-no-social-proof': () =>
      checkIds(runConversionFrictionChecks(healthyMeta({ pageText: 'Get started', links: [], h1s: ['Product'], ctaTexts: ['Get started'] }))),

    // trust-psychology
    'trust-no-authority-signals': () =>
      checkIds(runTrustPsychologyChecks(healthyMeta({ pageText: 'We make a nice product.', links: [] }))),
    'trust-testimonial-quality': () =>
      checkIds(runTrustPsychologyChecks(healthyMeta({ pageText: '"Everyone loves our product." Contact support@example.com. As seen in TechCrunch.', links: [], ctaTexts: ['Buy'] }))),
    'trust-unsupported-claims': () =>
      checkIds(runTrustPsychologyChecks(healthyMeta({ pageText: 'The best product for everyone.', links: [] }))),
    'trust-no-direct-contact': () =>
      checkIds(runTrustPsychologyChecks(healthyMeta({ pageText: 'We make a product.', hasContactInfo: false, links: [] }))),
    'trust-no-internal-links': () =>
      checkIds(runTrustPsychologyChecks(healthyMeta({ pageText: 'We make a product.', links: [], ctaTexts: ['Buy'] }))),

    // visual-hierarchy
    'hierarchy-competing-actions': () =>
      checkIds(
        runVisualHierarchyChecks(
          healthyMeta({ h1s: ['Product'], h2s: ['Feature A', 'Feature B'], pageText: '' }),
          healthyCaptureMetrics({ competingPrimaryCtaCount: 2, competingPrimaryCtaLabels: ['Get started', 'Book a demo'] })
        )
      ),
    'hierarchy-too-many-fonts': () =>
      checkIds(
        runVisualHierarchyChecks(
          healthyMeta({ h1s: ['Product'], h2s: ['Feature A'], pageText: '' }),
          healthyCaptureMetrics({ uniqueFontFamilies: 4, fontFamilySample: ['Arial', 'Helvetica', 'Georgia', 'Times'] })
        )
      ),
    'hierarchy-no-sections': () =>
      checkIds(runVisualHierarchyChecks(healthyMeta({ h1s: ['Product'], h2s: [], pageText: '' }), null)),
    'hierarchy-no-headline': () =>
      checkIds(runVisualHierarchyChecks(healthyMeta({ h1s: [], h2s: [], pageText: 'Some body content here to exceed the 50 char threshold for detecting visible text.' }), null)),
    'hierarchy-information-density': () =>
      checkIds(
        runVisualHierarchyChecks(
          healthyMeta({
            h1s: ['Product title here for testing the information density check across headings'],
            h2s: [
              'Subheading one with many words to push the total count above the threshold of eighty words total across all of these headings',
              'Subheading two adds even more words so the total goes well beyond the eighty word limit for this particular test scenario',
              'Subheading three continues adding textual content for the information density calculation to be thorough and realistic',
              'Subheading four keeps padding the word count so the aggregate comfortably clears the eighty word boundary with margin',
            ],
            pageText: '',
          }),
          null
        )
      ),

    // mobile-ux-quality
    'mobile-input-zoom': () =>
      checkIds(
        runMobileUXQualityChecks(
          healthyMeta({}),
          healthyCaptureMetrics({ inputsBelow16px: [{ selector: '#email', fontSize: 14 }] })
        )
      ),
    'mobile-cta-thumb-zone': () =>
      checkIds(
        runMobileUXQualityChecks(
          healthyMeta({}),
          healthyCaptureMetrics({ mobilePrimaryCtaTopPx: 700, mobilePrimaryCtaText: 'Get started', mobileViewportHeight: 800 })
        )
      ),
    'mobile-cta-weak-label': () =>
      checkIds(
        runMobileUXQualityChecks(
          healthyMeta({}),
          healthyCaptureMetrics({ mobilePrimaryCtaText: 'Learn more', mobilePrimaryCtaTopPx: 300 })
        )
      ),
    'mobile-stuck-loading': () =>
      checkIds(
        runMobileUXQualityChecks(
          healthyMeta({}),
          healthyCaptureMetrics({ stuckLoadingIndicator: true, stuckLoadingLabel: 'skeleton' })
        )
      ),
    'mobile-no-viewport': () =>
      checkIds(runMobileUXQualityChecks(healthyMeta({ viewport: null }), null)),
    'mobile-load-delay-content': () =>
      checkIds(
        runMobileUXQualityChecks(
          healthyMeta({}),
          healthyCaptureMetrics({
            loadExperience: {
              device: 'mobile',
              initialScreenshotUrl: '/screenshots/mobile-initial.png',
              initialCaptureElapsedMs: 500,
              finalCaptureElapsedMs: 6000,
              loadingVisibleAtInitial: true,
              loadingVisibleAtFinal: false,
              loadingClearedMs: 4500,
              loadingLabel: 'spinner',
              finalReadyState: 'complete',
              finalTitle: 'Loaded',
            },
          })
        )
      ),
  }

  it('triggers matrix covers every checkId without extras', () => {
    const triggerKeys = Object.keys(triggers).sort()
    const allIds = [...ALL_CHECK_IDS].sort()
    assert.deepEqual(triggerKeys, allIds)
  })

  for (const checkId of ALL_CHECK_IDS) {
    it(`fires ${checkId}`, async () => {
      const ids = await triggers[checkId]()
      assert.ok(ids.includes(checkId), `expected ${checkId}, got ${ids.join(', ')}`)
    })
  }
})
