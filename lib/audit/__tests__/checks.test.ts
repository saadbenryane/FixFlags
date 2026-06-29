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
import { runDesignLanguageChecks } from '@/lib/audit/checks/design-language'
import { runMeasurementChecks } from '@/lib/audit/checks/measurement'
import { runSecurityBasicsChecks } from '@/lib/audit/checks/security'
import { runVisualPolishChecks } from '@/lib/audit/checks/visual-polish'
import { computeRubricScores, runAllChecks } from '@/lib/audit/checks'
import { ALL_CHECK_IDS, CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import { allCheckIdsHaveVerificationRules } from '@/lib/audit/verify-flags'
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
    'motion-ignores-reduced-preference': () =>
      checkIds(
        runInteractionChecks(
          healthyCaptureMetrics({
            motionIgnoresReducedPreference: true,
            motionSampleLabel: 'animate-pulse',
          })
        )
      ),
    'font-family-sprawl': () =>
      checkIds(
        runDesignLanguageChecks(
          healthyCaptureMetrics({
            uniqueFontFamilies: 6,
            fontFamilySample: ['Inter', 'Roboto', 'Georgia', 'Arial', 'Helvetica', 'Times'],
          })
        )
      ),
    'button-radius-inconsistent': () =>
      checkIds(
        runDesignLanguageChecks(
          healthyCaptureMetrics({
            buttonBorderRadii: [0, 8, 24],
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
    'form-inputs-zoom-mobile': () =>
      checkIds(
        runInteractionChecks(healthyCaptureMetrics({
          inputsBelow16px: [{ selector: '#email', fontSize: 14 }],
        }))
      ),
    'measurement-ga-gtm-posthog-missing': () =>
      checkIds(runMeasurementChecks(healthyMeta({ hasAnalytics: false }))),
    'measurement-consent-blocking-incomplete': () =>
      checkIds(runMeasurementChecks(healthyMeta({ hasAnalytics: true, hasCookieConsent: false }))),
    'security-mixed-content': () =>
      checkIds(runSecurityBasicsChecks('https://example.com', healthyMeta({
        images: [{ src: '/hero.png', alt: 'Screenshot' }, { src: 'http://cdn.example.com/img.png', alt: 'Insecure image' }],
        links: [{ href: 'http://oldcdn.example.com/style.css', text: 'Stylesheet', rel: null }],
      }))),
    'visual-radius-inconsistent': () =>
      checkIds(runVisualPolishChecks(healthyCaptureMetrics({ buttonBorderRadii: [0, 8, 24] }))),
    'visual-typography-sprawl': () =>
      checkIds(runVisualPolishChecks(healthyCaptureMetrics({ uniqueFontFamilies: 6, fontFamilySample: ['Inter', 'Roboto', 'Georgia', 'Arial', 'Helvetica', 'Times'] }))),
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
