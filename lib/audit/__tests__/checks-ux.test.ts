import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { runMessagingClarityChecks } from '@/lib/audit/checks/messaging-clarity'
import { runConversionFrictionChecks } from '@/lib/audit/checks/conversion-friction'
import { runTrustPsychologyChecks } from '@/lib/audit/checks/trust-psychology'
import { runVisualHierarchyChecks } from '@/lib/audit/checks/visual-hierarchy'
import { runMobileUXQualityChecks } from '@/lib/audit/checks/mobile-ux-quality'
import { runAllChecks } from '@/lib/audit/checks'
import { ALL_CHECK_IDS } from '@/lib/audit/check-ids'
import type { PageMetadata } from '@/lib/audit/metadata'
import type { CaptureMetrics } from '@/lib/audit/capture-metrics'
import type { PageSpeedResult } from '@/lib/audit/pagespeed'

function healthyMeta(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    title: 'Build better software | Acme Corp',
    description: 'Acme Corp helps teams ship faster with our developer platform.',
    ogTitle: 'Build better software | Acme Corp',
    ogDescription: 'Acme Corp helps teams ship faster with our developer platform.',
    ogImage: 'https://example.com/og.png',
    canonical: 'https://example.com/',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    robots: 'index, follow',
    h1s: ['Build internal tools 10x faster - for engineering teams'],
    h2s: ['Features', 'Pricing', 'Testimonials', 'FAQ'],
    images: [{ src: 'https://example.com/hero.png', alt: 'Product screenshot' }],
    imagesWithoutAlt: 0,
    links: [
      { href: '/features', text: 'Features', rel: null },
      { href: '/pricing', text: 'Pricing', rel: null },
      { href: 'https://example.com/docs', text: 'Docs', rel: null },
    ],
    forms: 0,
    inputsWithoutLabel: 0,
    buttonsWithoutText: 0,
    linksWithoutText: 0,
    iframesWithoutTitle: 0,
    positiveTabindex: 0,
    ctaTexts: ['Get started free'],
    hasStructuredData: true,
    structuredDataTypes: ['WebSite'],
    hasAnalytics: true,
    hasCookieBasedAnalytics: true,
    hasCookieConsent: true,
    hasPrivacyPolicy: true,
    hasContactInfo: true,
    hasFavicon: true,
    hasSkipLink: true,
    navLandmarkCount: 2,
    pageText: 'Build internal tools 10x faster. Acme Corp is the platform that helps engineering teams build dashboards, automations, and internal apps in hours instead of weeks. Features include drag-and-drop UI builder, SQL query editor, and team permissions. Get started free with our 14-day trial. Join 10,000+ teams who trust Acme Corp.',
    jsonLd: [],
    elementIds: ['features', 'pricing', 'faq'],
    formInputsMissingValidation: 0,
    totalFormInputs: 0,
    maxConversionFormInputs: 0,
    ...overrides,
  }
}

function healthyMobilePs(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return {
    strategy: 'mobile',
    score: 85,
    lcp: 1800,
    cls: 0.05,
    fcp: 1200,
    tbt: 50,
    inp: 150,
    opportunities: [],
    failedAccessibilityAudits: [],
    diagnostics: {},
    raw: {},
    crux: null,
    ...overrides,
  }
}

function healthyDesktopPs(overrides: Partial<PageSpeedResult> = {}): PageSpeedResult {
  return {
    strategy: 'desktop',
    score: 92,
    lcp: 1500,
    cls: 0.03,
    fcp: 900,
    tbt: 30,
    inp: 80,
  opportunities: [],
  failedAccessibilityAudits: [],
  diagnostics: {},
  raw: {},
  crux: null,
  ...overrides,
}
}

function captureMetrics(overrides: Partial<CaptureMetrics> = {}): CaptureMetrics {
  return {
    mobilePrimaryCtaTopPx: 400,
    mobilePrimaryCtaText: 'Get started free',
    competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started free'],
    mobileViewportHeight: 812,
    mobileScrollY: 0,
    mobileDocumentHeight: 4000,
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

function checkIds(findings: Array<{ checkId: string }>): string[] {
  return findings.map((f) => f.checkId)
}

describe('runMessagingClarityChecks', () => {
  it('flags weak value prop in headline', () => {
    assert.ok(
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['The platform solution'] }))).includes('messaging-weak-value-prop')
    )
  })

  it('flags marketing jargon in headings', () => {
    assert.ok(
      checkIds(runMessagingClarityChecks(healthyMeta({
        h1s: ['Leverage our innovative platform to empower your team'],
      }))).includes('messaging-jargon-overload')
    )
  })

  it('flags missing audience in headline', () => {
    assert.ok(
      checkIds(runMessagingClarityChecks(healthyMeta({ h1s: ['Beautiful dashboards'] }))).includes('messaging-no-audience')
    )
  })

  it('flags long sentences in body text', () => {
    assert.ok(
      checkIds(runMessagingClarityChecks(healthyMeta({
        pageText: 'This is a very long sentence that goes on and on about many different things without ever stopping to let the reader breathe or take a moment to process what was just said because there is just so much information packed into one single sentence that it becomes almost unreadable and definitely not scannable for anyone who is in a hurry. And here is another long sentence that similarly just keeps going with too many clauses and sub-clauses making it hard to follow the actual point that the author is trying to make. And here is a third one for good measure because three long sentences make a pattern that our check should definitely detect and flag as a readability issue.',
      }))).includes('messaging-long-sentences')
    )
  })

  it('passes a strong, clear headline with audience', () => {
    const findings = runMessagingClarityChecks(healthyMeta())
    assert.equal(findings.length, 0)
  })
})

describe('runConversionFrictionChecks', () => {
  it('flags missing commitment path (no trial, demo, or pricing)', () => {
    assert.ok(
      checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: [],
        links: [],
        pageText: 'Welcome to our site. We make great software.',
      }))).includes('friction-no-commitment-path')
    )
  })

  it('does not flag missing commitment path when a pricing link exists', () => {
    assert.ok(
      !checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: [],
        links: [{ href: '/pricing', text: 'Pricing', rel: null }],
        pageText: 'Welcome to our site. We make great software.',
      }))).includes('friction-no-commitment-path')
    )
  })

  it('uses a studio prescription when a consulting page has no first step', () => {
    const findings = runConversionFrictionChecks(
      healthyMeta({
        ctaTexts: ['View case studies'],
        links: [{ href: '/work', text: 'Work', rel: null }],
        pageText: 'I build products, brands, and companies. Selected case studies.',
      }),
      { purpose: 'studio', reasons: ['studio signal'] }
    )
    const missing = findings.find((f) => f.checkId === 'friction-no-commitment-path')
    assert.ok(missing)
    assert.match(missing.fix, /start a project/i)
    assert.doesNotMatch(missing.fix, /start a trial/i)
  })

  it('does not flag a studio page that already has a contact path', () => {
    assert.ok(
      !checkIds(runConversionFrictionChecks(
        healthyMeta({
          ctaTexts: ['Start a project'],
          links: [{ href: '/contact', text: 'Get in touch', rel: null }],
          pageText: 'I build products, brands, and companies. Start a project. View case studies.',
        }),
        { purpose: 'studio', reasons: ['studio signal'] }
      )).includes('friction-no-commitment-path')
    )
  })

  it('treats start a project and get in touch as a conversion path', () => {
    assert.ok(
      !checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Start a project'],
        links: [{ href: '/contact', text: 'Get in touch', rel: null }],
        pageText: 'I build products, brands, and companies. Start a project. View case studies.',
      }))).includes('friction-no-commitment-path')
    )
  })

  it('treats add to cart as a commerce conversion path', () => {
    assert.ok(
      !checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Add to Cart'],
        links: [{ href: '/cart', text: 'Cart', rel: null }],
        pageText: 'Premium outdoor gear. Trailblazer Waterproof Jacket. Add to Cart.',
      }))).includes('friction-no-commitment-path')
    )
  })

  it('treats booking a call as a low-commitment conversion path', () => {
    assert.ok(
      !checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Book a call'],
        links: [{ href: 'https://calendar.example.com', text: 'Book a call', rel: null }],
        pageText: 'Prefer to book time directly? Book a call.',
      }))).includes('friction-no-commitment-path')
    )
  })

  it('flags forms with too many fields', () => {
    assert.ok(
      checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Get started'],
        totalFormInputs: 8,
        maxConversionFormInputs: 8,
        pageText: 'Sign up for a free trial.',
      }))).includes('friction-form-too-many-fields')
    )
  })

  it('flags missing risk reversal on sign-up CTAs', () => {
    assert.ok(
      checkIds(runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Sign up free'],
        pageText: 'Sign up now and get started.',
      }))).includes('friction-no-risk-reversal')
    )
  })

  it('flags missing social proof when CTAs exist', () => {
    const findings = runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Get started'],
        pageText: 'Start building today. No credit card required.',
      }))
    const socialProofFlag = findings.find((f) => f.checkId === 'friction-no-social-proof')
    assert.ok(socialProofFlag)
    assert.doesNotMatch(socialProofFlag.fix, /Join 10,000/i)
    assert.match(socialProofFlag.fix, /do not have proof yet/i)
  })

  it('keeps missing social proof as one fix, not a testimonial-quality duplicate', () => {
    const meta = healthyMeta({
      ctaTexts: ['Get started'],
      pageText: 'Start building today. No credit card required.',
    })
    assert.ok(checkIds(runConversionFrictionChecks(meta)).includes('friction-no-social-proof'))
    assert.ok(!checkIds(runTrustPsychologyChecks(meta)).includes('trust-testimonial-quality'))
  })

  it('passes with free trial + no-cc + social proof', () => {
    assert.equal(
      runConversionFrictionChecks(healthyMeta({
        ctaTexts: ['Start free trial'],
        pageText: 'Start your free 14-day trial. No credit card required. Join 10,000+ teams.',
      })).length,
      0
    )
  })
})

describe('runTrustPsychologyChecks', () => {
  it('flags missing authority signals', () => {
    assert.ok(
      checkIds(runTrustPsychologyChecks(healthyMeta({
        ctaTexts: ['Get started'],
        pageText: 'Sign up today. Build better software with our platform. We help engineering teams ship faster and more reliably than ever before. Get started now.',
      }))).includes('trust-no-authority-signals')
    )
  })

  it('flags unsupported superlative claims', () => {
    assert.ok(
      checkIds(runTrustPsychologyChecks(healthyMeta({
        pageText: 'We are the best platform for building the fastest apps. Sign up today.',
      }))).includes('trust-unsupported-claims')
    )
  })

  it('flags missing direct contact method', () => {
    assert.ok(
      checkIds(runTrustPsychologyChecks(healthyMeta({
        hasContactInfo: false,
        pageText: 'Welcome to our site. We make great software.',
      }))).includes('trust-no-direct-contact')
    )
  })

  it('flags testimonial quality only when testimonial-like proof exists', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      ctaTexts: ['Get started'],
      pageText: '"Great product." Customer feedback from beta users. Contact support@example.com. As seen in TechCrunch.',
    }))
    assert.ok(checkIds(findings).includes('trust-testimonial-quality'))
  })

  it('passes with authority signals and specific testimonials', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      pageText: 'As seen in TechCrunch. "Acme Corp reduced our build time by 60%" - Sarah Chen, CTO at DataFlow. Backed by Y Combinator.',
    }))
    const ids = checkIds(findings)
    assert.ok(!ids.includes('trust-no-authority-signals'))
    assert.ok(!ids.includes('trust-unsupported-claims'))
  })

  it('counts same-origin absolute links from canonical, not og:image host', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      canonical: 'https://app.example.com/',
      ogImage: 'https://cdn.example.com/og.png',
      ctaTexts: ['Get started'],
      links: [
        { href: 'https://app.example.com/pricing', text: 'Pricing', rel: null },
        { href: 'https://app.example.com/docs', text: 'Docs', rel: null },
      ],
      pageText: 'Contact support@example.com. "Acme helped our team launch faster with less manual QA work." - Sarah Chen, CTO at DataFlow. As seen in TechCrunch.',
    }))
    assert.ok(!checkIds(findings).includes('trust-no-internal-links'))
  })

  it('does not treat unknown absolute hosts as internal without canonical', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      canonical: null,
      ctaTexts: ['Get started'],
      links: [
        { href: 'https://docs.example.com', text: 'Docs', rel: null },
        { href: 'https://status.example.com', text: 'Status', rel: null },
      ],
      pageText: 'Contact support@example.com. "Acme helped our team launch faster with less manual QA work." - Sarah Chen, CTO at DataFlow. As seen in TechCrunch.',
    }))
    assert.ok(checkIds(findings).includes('trust-no-internal-links'))
  })

  it('does not count non-navigation hrefs as internal links', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      canonical: 'https://example.com/',
      ctaTexts: ['Get started'],
      links: [
        { href: '/pricing', text: 'Pricing', rel: null },
        { href: 'mailto:support@example.com', text: 'Email support', rel: null },
        { href: 'tel:+15555551212', text: 'Call sales', rel: null },
        { href: '#faq', text: 'FAQ', rel: null },
        { href: 'javascript:void(0)', text: 'Open modal', rel: null },
      ],
      pageText: 'Contact support@example.com. "Acme helped our team launch faster with less manual QA work." - Sarah Chen, CTO at DataFlow. As seen in TechCrunch.',
    }))
    assert.ok(checkIds(findings).includes('trust-no-internal-links'))
  })

  it('counts relative and same-host absolute navigation links as internal', () => {
    const findings = runTrustPsychologyChecks(healthyMeta({
      canonical: 'https://example.com/',
      ctaTexts: ['Get started'],
      links: [
        { href: '/pricing', text: 'Pricing', rel: null },
        { href: 'https://example.com/docs', text: 'Docs', rel: null },
        { href: 'mailto:support@example.com', text: 'Email support', rel: null },
      ],
      pageText: 'Contact support@example.com. "Acme helped our team launch faster with less manual QA work." - Sarah Chen, CTO at DataFlow. As seen in TechCrunch.',
    }))
    assert.ok(!checkIds(findings).includes('trust-no-internal-links'))
  })
})

describe('runVisualHierarchyChecks', () => {
  it('flags competing CTAs above the fold', () => {
    assert.ok(
      checkIds(runVisualHierarchyChecks(healthyMeta(), captureMetrics({
        competingPrimaryCtaCount: 3,
        competingPrimaryCtaLabels: ['Get started', 'Book a demo', 'Subscribe'],
      }))).includes('hierarchy-competing-actions')
    )
  })

  it('flags missing H1 headline', () => {
    assert.ok(
      checkIds(runVisualHierarchyChecks(healthyMeta({ h1s: [] }), captureMetrics())).includes('hierarchy-no-headline')
    )
  })

  it('passes a clean page with proper hierarchy', () => {
    assert.equal(
      runVisualHierarchyChecks(healthyMeta(), captureMetrics()).length,
      0
    )
  })
})

describe('runMobileUXQualityChecks', () => {
  it('flags inputs below 16px on mobile', () => {
    assert.ok(
      checkIds(runMobileUXQualityChecks(healthyMeta(), captureMetrics({
        inputsBelow16px: [{ selector: '#email', fontSize: 14 }],
      }))).includes('mobile-input-zoom')
    )
  })

  it('flags weak mobile CTA labels', () => {
    assert.ok(
      checkIds(runMobileUXQualityChecks(healthyMeta(), captureMetrics({
        mobilePrimaryCtaText: 'Click here',
        mobilePrimaryCtaTopPx: 400,
      }))).includes('mobile-cta-weak-label')
    )
  })

  it('does not describe a visible bottom CTA as hard to reach', () => {
    assert.ok(
      !checkIds(runMobileUXQualityChecks(healthyMeta(), captureMetrics({
        mobilePrimaryCtaText: 'Book a call',
        mobilePrimaryCtaTopPx: 743,
        mobileViewportHeight: 812,
      }))).includes('mobile-cta-thumb-zone')
    )
  })

  it('does not double-flag missing viewport meta tag (owned by metadata-checks.ts)', () => {
    assert.ok(
      !checkIds(runMobileUXQualityChecks(healthyMeta({ viewport: null }), captureMetrics())).includes(
        'mobile-no-viewport'
      )
    )
  })

  it('passes a well-optimized mobile page', () => {
    assert.equal(
      runMobileUXQualityChecks(healthyMeta(), captureMetrics()).length,
      0
    )
  })

  it('does not flag mobile load delay from a slow desktop load', () => {
    assert.ok(
      !checkIds(
        runMobileUXQualityChecks(
          healthyMeta(),
          captureMetrics({
            loadExperience: {
              device: 'desktop',
              initialScreenshotUrl: '/screenshots/desktop-initial.png',
              initialCaptureElapsedMs: 500,
              finalCaptureElapsedMs: 6000,
              loadingVisibleAtInitial: true,
              loadingVisibleAtFinal: false,
              loadingClearedMs: 5500,
              loadingLabel: 'spinner',
              finalReadyState: 'complete',
              finalTitle: 'Loaded',
            },
          })
        )
      ).includes('mobile-load-delay-content')
    )
  })
})

describe('new check IDs registered in ALL_CHECK_IDS', () => {
  const NEW_IDS = [
    'messaging-weak-value-prop',
    'messaging-jargon-overload',
    'messaging-no-audience',
    'messaging-long-sentences',
    'messaging-headline-too-short',
    'friction-no-commitment-path',
    'friction-trial-commitment-unclear',
    'friction-form-too-many-fields',
    'friction-no-risk-reversal',
    'friction-no-social-proof',
    'trust-no-authority-signals',
    'trust-testimonial-quality',
    'trust-unsupported-claims',
    'trust-no-direct-contact',
    'trust-no-internal-links',
    'hierarchy-competing-actions',
    'hierarchy-no-sections',
    'hierarchy-no-headline',
    'hierarchy-information-density',
    'mobile-input-zoom',
    'mobile-cta-thumb-zone',
    'mobile-cta-weak-label',
    'mobile-load-delay-content',
  ]

  for (const id of NEW_IDS) {
    it(`includes "${id}"`, () => {
      assert.ok(
        (ALL_CHECK_IDS as readonly string[]).includes(id),
        `Missing check ID: ${id}`
      )
    })
  }
})

describe('new checks run in pipeline', () => {
  it('runAllChecks invokes new modules and returns their checkIds', async () => {
    const { flags } = await runAllChecks(
      'https://example.com',
      healthyMeta({
        h1s: ['The platform for modern teams'],
        ctaTexts: ['Sign up'],
        pageText: 'We are the best platform for building software. Sign up today. No contact info anywhere.',
      }),
      healthyDesktopPs(),
      healthyMobilePs(),
      [],
      undefined,
      captureMetrics({
        competingPrimaryCtaCount: 3,
        competingPrimaryCtaLabels: ['Get started', 'Book a demo', 'Contact sales'],
        inputsBelow16px: [{ selector: '#email', fontSize: 14 }],
      }),
      null
    )
    const ids = checkIds(flags)
    const newUxIds = ids.filter((id) =>
      id.startsWith('messaging-') || id.startsWith('friction-') || id.startsWith('trust-') || id.startsWith('hierarchy-') || id.startsWith('mobile-')
    )
    assert.ok(newUxIds.length > 0, `Expected some new UX checkIds, got: ${ids.join(', ')}`)
  })

  it('returns only registry checkIds when new checks fire', async () => {
    const { flags } = await runAllChecks(
      'https://example.com',
      healthyMeta({
        h1s: ['Welcome to the best platform for teams'],
        ctaTexts: ['Sign up free'],
        pageText: 'We are the best platform ever. Join today.',
        hasContactInfo: false,
      }),
      healthyDesktopPs({ score: 40, lcp: 5000, cls: 0.3 }),
      healthyMobilePs({ score: 40, lcp: 5000 }),
      [{ type: 'error', text: 'TypeError: x is not a function' }, { type: 'error', text: 'Failed to load' }, { type: 'error', text: 'Network error' }],
      undefined,
      captureMetrics({
        competingPrimaryCtaCount: 2,
        inputsBelow16px: [{ selector: '#name', fontSize: 13 }],
      }),
      null
    )
    for (const finding of flags) {
      assert.ok(
        (ALL_CHECK_IDS as readonly string[]).includes(finding.checkId),
        `unexpected checkId: ${finding.checkId}`
      )
    }
  })
})
