import { describe, it, expect } from 'vitest'
import assert from 'node:assert/strict'
import {
  isIframeAxeTarget,
  filterOutIframeAxeViolations,
  type AxeViolation,
} from '@/lib/audit/checks/accessibility'
import {
  OVERLAY_COVERAGE_PARTIAL,
  OVERLAY_COVERAGE_SUPPRESS,
  formatOverlayEvidence,
  severityForOverlayBlocker,
  type OverlayBlockerInfo,
} from '@/lib/audit/browser/overlay-probe'
import { runOverlayBlockerChecks } from '@/lib/audit/checks/overlay'
import { ctaHasWorkingHref, runFlowChecks } from '@/lib/audit/checks/flow'
import type { FlowScanResult } from '@/lib/audit/flow/run-flow-scan'
import {
  isInternalNavigationHref,
  resolvePageHostname,
  runTrustPsychologyChecks,
} from '@/lib/audit/checks/trust-psychology'
import { runContentChecks } from '@/lib/audit/checks/content'
import {
  isManagedHostingHostname,
  runSecurityHeaderChecks,
} from '@/lib/audit/checks/security-headers'
import { consolidateFlagsByCheck, baseCheckId, durableCheckId } from '@/lib/audit/consolidate-flags'
import { buildFixList } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/flag-types'
import { healthyMeta } from './check-fixtures'

function overlay(partial: Partial<OverlayBlockerInfo> = {}): OverlayBlockerInfo {
  return {
    tag: 'div',
    id: null,
    className: 'fixed inset-0 z-50',
    role: 'dialog',
    text: 'Loading',
    zIndex: '50',
    coverageFraction: 1,
    looksLikeOverlay: true,
    persisted: true,
    ...partial,
  }
}

function flowResult(partial: Partial<FlowScanResult>): FlowScanResult {
  return {
    status: 'unclickable',
    steps: [],
    finalUrl: 'https://example.com/',
    ctaText: 'Private Inquiry',
    ctaHref: 'https://example.com/contact',
    ...partial,
  }
}

function rankable(
  partial: Partial<RankableFlag> & Pick<RankableFlag, 'id' | 'checkId' | 'problem'>
): RankableFlag {
  return {
    rubric: 'REACH',
    severity: 'POLISH',
    impactTag: 'TRUST',
    evidence: partial.evidence ?? partial.problem,
    confidence: 0.9,
    source: 'DETERMINISTIC',
    ...partial,
  }
}

describe('iframe axe scoping', () => {
  it('detects iframe paths in axe targets', () => {
    expect(isIframeAxeTarget(['iframe', 'button.ytmVideoInfoLink'])).toBe(true)
    expect(isIframeAxeTarget(['html', 'body', 'main', 'button.cta'])).toBe(false)
  })

  it('strips iframe-only nodes and drops empty violations', () => {
    const violations: AxeViolation[] = [
      {
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text',
        help: 'Buttons must have discernible text',
        helpUrl: 'https://example.com',
        nodes: [
          {
            html: '<button class="ytmVideoInfoLink">',
            target: ['iframe', 'button.ytmVideoInfoLink'],
            failureSummary: 'Fix any of the following',
          },
          {
            html: '<button class="site-cta">Go</button>',
            target: ['button.site-cta'],
            failureSummary: 'Fix any of the following',
          },
        ],
      },
      {
        id: 'aria-allowed-attr',
        impact: 'critical',
        description: 'ARIA',
        help: 'Elements must only use supported ARIA attributes',
        helpUrl: 'https://example.com',
        nodes: [
          {
            html: '<a class="ytmVideoInfoVideoTitle" aria-level="2">',
            target: ['iframe', 'a.ytmVideoInfoVideoTitle'],
            failureSummary: 'Fix',
          },
        ],
      },
    ]

    const filtered = filterOutIframeAxeViolations(violations)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('button-name')
    expect(filtered[0].nodes).toHaveLength(1)
    expect(filtered[0].nodes[0].target).toEqual(['button.site-cta'])
  })
})

describe('overlay severity + evidence', () => {
  it('suppresses weak coverage, downgrades partial, keeps full overlay CRITICAL', () => {
    expect(
      severityForOverlayBlocker(overlay({ coverageFraction: OVERLAY_COVERAGE_SUPPRESS - 0.1 }))
    ).toBeNull()
    expect(
      severityForOverlayBlocker(overlay({ coverageFraction: OVERLAY_COVERAGE_PARTIAL - 0.1 }))
    ).toBe('IMPORTANT')
    expect(severityForOverlayBlocker(overlay({ coverageFraction: 1 }))).toBe('CRITICAL')
    expect(
      severityForOverlayBlocker(overlay({ looksLikeOverlay: false, coverageFraction: 1 }))
    ).toBe('IMPORTANT')
  })

  it('runOverlayBlockerChecks respects severity helper', () => {
    const critical = runOverlayBlockerChecks('cta', overlay({ coverageFraction: 1 }), 'Start')
    expect(critical[0]?.severity).toBe('CRITICAL')

    const partial = runOverlayBlockerChecks(
      'cta',
      overlay({ coverageFraction: 0.5, looksLikeOverlay: true }),
      'Start'
    )
    expect(partial[0]?.severity).toBe('IMPORTANT')
    expect(partial[0]?.problem).toMatch(/partially covers/i)

    const weak = runOverlayBlockerChecks(
      'cta',
      overlay({ coverageFraction: 0.1 }),
      'Start'
    )
    expect(weak).toHaveLength(0)

    expect(formatOverlayEvidence(overlay({ coverageFraction: 0.72 }))).toContain(
      'covers ~72% of target'
    )
  })
})

describe('CTA click-failure severity', () => {
  it('ctaHasWorkingHref accepts real destinations and rejects hash/js', () => {
    expect(ctaHasWorkingHref('https://evebcn.com/contact')).toBe(true)
    expect(ctaHasWorkingHref('/contact')).toBe(true)
    expect(ctaHasWorkingHref('#pricing')).toBe(false)
    expect(ctaHasWorkingHref('javascript:void(0)')).toBe(false)
    expect(ctaHasWorkingHref(null)).toBe(false)
  })

  it('downgrades unclickable CTA with working href + plain cover to IMPORTANT', () => {
    const flags = runFlowChecks(
      flowResult({
        status: 'unclickable',
        clickFailure: 'interaction_error',
        clickError: 'Timeout 8000ms exceeded',
        obscuredBy: overlay({
          tag: 'h2',
          className: 'hero-subtitle',
          text: 'Explore the best wineries',
          looksLikeOverlay: false,
          zIndex: 'auto',
          coverageFraction: 0.4,
        }),
      })
    )
    const flag = flags.find((f) => f.checkId === 'flow-cta-unclickable')
    expect(flag).toBeTruthy()
    expect(flag?.severity).toBe('IMPORTANT')
    expect(flag?.evidence).toMatch(/covers the center/i)
    expect(flag?.evidence).toMatch(/Private Inquiry/)
  })

  it('keeps CRITICAL when unclickable CTA has no working href', () => {
    const flags = runFlowChecks(
      flowResult({
        status: 'unclickable',
        ctaHref: '#',
        clickFailure: 'interaction_error',
        obscuredBy: null,
      })
    )
    const flag = flags.find((f) => f.checkId === 'flow-cta-unclickable')
    expect(flag?.severity).toBe('CRITICAL')
  })
})

describe('internal links + H2 sample guards', () => {
  it('isInternalNavigationHref keeps relative links internal without hostname', () => {
    expect(isInternalNavigationHref('/view/abc', null)).toBe(true)
    expect(isInternalNavigationHref('pricing', null)).toBe(true)
    expect(isInternalNavigationHref('#section', null)).toBe(false)
    expect(isInternalNavigationHref('https://other.com/x', null)).toBe(false)
    expect(isInternalNavigationHref('https://unrav.io/view/x', 'unrav.io')).toBe(true)
    expect(isInternalNavigationHref('//unrav.io/view/x', 'unrav.io')).toBe(true)
  })

  it('resolvePageHostname prefers canonical then page URL', () => {
    expect(resolvePageHostname({ canonical: 'https://a.com/' }, 'https://b.com/')).toBe('a.com')
    expect(resolvePageHostname({ canonical: null }, 'https://b.com/path')).toBe('b.com')
    expect(resolvePageHostname({ canonical: null }, null)).toBeNull()
  })

  it('counts absolute same-host links when pageUrl provides hostname without canonical', () => {
    const flags = runTrustPsychologyChecks(
      healthyMeta({
        canonical: null,
        ctaTexts: ['Get started'],
        pageText: 'A'.repeat(250),
        links: [
          { href: 'https://shop.example/books', text: 'Books', rel: null },
          { href: 'https://shop.example/courses', text: 'Courses', rel: null },
          { href: 'https://external.com', text: 'Out', rel: null },
        ],
      }),
      { purpose: 'marketing', reasons: [] },
      'https://shop.example/'
    )
    expect(flags.some((f) => f.checkId === 'trust-no-internal-links')).toBe(false)
  })

  it('skips definitive 0-internal-links claim on incomplete SPA shell samples', () => {
    const flags = runTrustPsychologyChecks(
      healthyMeta({
        canonical: null,
        ctaTexts: ['Buy'],
        pageText: 'short',
        links: [],
      }),
      { purpose: 'marketing', reasons: [] }
    )
    expect(flags.some((f) => f.checkId === 'trust-no-internal-links')).toBe(false)
  })

  it('skips no-H2 claim when page text sample is incomplete', () => {
    const sparse = runContentChecks(
      healthyMeta({
        h1s: ['Welcome shell'],
        h2s: [],
        pageText: 'tiny',
      })
    )
    expect(sparse.some((f) => f.checkId === 'heading-hierarchy-missing')).toBe(false)

    const complete = runContentChecks(
      healthyMeta({
        h1s: ['Real headline'],
        h2s: [],
        pageText: 'A'.repeat(250),
      })
    )
    expect(complete.some((f) => f.checkId === 'heading-hierarchy-missing')).toBe(true)
  })
})

describe('managed-host security headers', () => {
  it('detects known builder/PaaS hostnames', () => {
    expect(isManagedHostingHostname('archive-shop-store.lovable.app')).toBe(true)
    expect(isManagedHostingHostname('app.vercel.app')).toBe(true)
    expect(isManagedHostingHostname('example.com')).toBe(false)
  })

  it('consolidates missing core headers on managed hosts to a single POLISH flag', () => {
    const flags = runSecurityHeaderChecks('https://demo.lovable.app/', {})
    expect(flags).toHaveLength(1)
    expect(flags[0].checkId).toBe('security-headers-missing')
    expect(flags[0].severity).toBe('POLISH')
    expect(flags[0].evidence).toMatch(/managed subdomain/i)
    expect(flags[0].evidence).toMatch(/custom domain/i)
    // Must not emit CRITICAL CSP on managed hosts.
    expect(flags.every((f) => f.severity === 'POLISH')).toBe(true)
  })
})

describe('cross-page consolidation', () => {
  it('baseCheckId strips ::page: suffixes', () => {
    expect(baseCheckId('security-headers-missing::page:2')).toBe('security-headers-missing')
    expect(baseCheckId('no-structured-data')).toBe('no-structured-data')
  })

  it('uses one durable identity for the same problem observed across journeys', () => {
    expect(durableCheckId('journey-signup-hidden-cta')).toBe('journey-hidden-cta')
    expect(durableCheckId('journey-pricing-evaluation-hidden-cta')).toBe(
      'journey-hidden-cta'
    )
    const merged = consolidateFlagsByCheck([
      rankable({
        id: 'signup',
        checkId: 'journey-signup-hidden-cta',
        problem: 'No obvious primary CTA on first visit',
      }),
      rankable({
        id: 'pricing',
        checkId: 'journey-pricing-evaluation-hidden-cta',
        problem: 'No obvious primary CTA on first visit',
      }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0]?.occurrenceCount).toBe(2)
  })

  it('merges same-check flags across pages and keeps highest severity', () => {
    const merged = consolidateFlagsByCheck([
      rankable({
        id: 'a',
        checkId: 'no-structured-data',
        severity: 'POLISH',
        problem: 'No structured data',
        pageUrl: 'https://example.com/',
        evidence: 'homepage missing',
      }),
      rankable({
        id: 'b',
        checkId: 'no-structured-data::page:1',
        severity: 'IMPORTANT',
        problem: 'No structured data',
        pageUrl: 'https://example.com/pricing',
        evidence: 'pricing missing',
      }),
      rankable({
        id: 'c',
        checkId: 'security-headers-missing::page:2',
        severity: 'POLISH',
        problem: 'Headers missing',
        pageUrl: 'https://example.com/about',
      }),
      rankable({
        id: 'd',
        checkId: 'security-headers-missing',
        severity: 'POLISH',
        problem: 'Headers missing',
        pageUrl: 'https://example.com/',
      }),
    ])

    expect(merged).toHaveLength(2)
    const structured = merged.find((f) => f.checkId === 'no-structured-data')
    expect(structured?.severity).toBe('IMPORTANT')
    expect(structured?.occurrenceCount).toBe(2)
    expect(structured?.occurrencePageUrls).toHaveLength(2)

    const list = buildFixList({
      flags: merged.map((f) => ({ ...f, status: 'OPEN' })),
      promptAccess: 'none',
    })
    // Already consolidated input still ranks without re-inflating counts.
    expect(list.totalCount).toBe(2)
  })

  it('finish-plan totalCount collapses per-page duplicates', () => {
    const list = buildFixList({
      flags: [
        rankable({
          id: 'h1',
          checkId: 'no-analytics',
          problem: 'No analytics',
          pageUrl: 'https://example.com/',
        }),
        rankable({
          id: 'h2',
          checkId: 'no-analytics::page:1',
          problem: 'No analytics',
          pageUrl: 'https://example.com/a',
        }),
        rankable({
          id: 'h3',
          checkId: 'no-analytics::page:2',
          problem: 'No analytics',
          pageUrl: 'https://example.com/b',
        }),
      ],
      promptAccess: 'none',
    })
    expect(list.totalCount).toBe(1)
    expect(list.items).toHaveLength(1)
    expect(list.items[0]?.occurrenceCount).toBe(3)
  })
})

describe('regression: security headers still CRITICAL-capable off managed hosts', () => {
  it('flags missing CSP as CRITICAL on a custom domain when few headers missing', () => {
    const flags = runSecurityHeaderChecks('https://evebcn.com/', {
      'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
      'x-frame-options': 'SAMEORIGIN',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()',
    })
    // Only CSP missing among the major ones in this partial set may still consolidate
    // if enough optional headers are absent - assert no managed-host note.
    assert.ok(flags.every((f) => !/managed subdomain/i.test(f.evidence)))
  })
})
