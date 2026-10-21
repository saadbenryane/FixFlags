import { describe, expect, it } from 'vitest'
import {
  asReviewDepth,
  auditDeadlineMsForDepth,
  classifyImportanceBand,
  planReviewTargets,
  rankDestinations,
  buildReviewCoverage,
  monitoringReviewUrls,
} from '@/lib/audit/review-depth'
import { collectEligibleDestinations } from '@/lib/audit/url-identity'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'

const ORIGIN = 'https://example.com/'

const LINKS = [
  { href: '/privacy', text: 'Privacy' },
  { href: '/blog/hello', text: 'A late blog post' },
  { href: '/pricing', text: 'See pricing' },
  { href: '/features', text: 'Features' },
  { href: '/checkout', text: 'Get started' },
]

describe('review depth', () => {
  it('retains admitted browser states on the same document while discovery keeps its anchor policy', () => {
    const target = ORIGIN + 'app/#/help', route = ORIGIN + 'app/#/pricing'
    expect(monitoringReviewUrls(target, [route, 'https://other.example/app/#/pricing', '#local'])).toEqual([target, route])
    expect(planReviewTargets({ pastedUrl: target, depth: 2, pastedLinks: [{ href: route, text: 'Pricing' }], retainedUrls: [route] }).reviewUrls)
      .toEqual([target, route])
    expect(planReviewTargets({ pastedUrl: target, depth: 2, pastedLinks: [{ href: route, text: 'Pricing' }] }).reviewUrls)
      .toEqual([target])
  })
  it('keeps each admitted navigation even when discovery groups its path, host or query variants together', () => {
    const retainedUrls = [ORIGIN + 'pricing', ORIGIN + 'pricing/', ORIGIN + 'pricing?utm_campaign=launch',
      ORIGIN + 'pricing?utm_campaign=return', ORIGIN + 'pricing?b=2&a=1', ORIGIN + 'pricing?a=1&b=2',
      ORIGIN + 'app#sign-in', ORIGIN + 'app#reset', 'https://www.example.com/pricing']
    const plan = planReviewTargets({ pastedUrl: ORIGIN, depth: 2, pastedLinks: [], retainedUrls })
    expect(plan.reviewUrls).toEqual([ORIGIN, ...retainedUrls])
    expect(plan.truncated).toBe(false)
    const limited = planReviewTargets({ pastedUrl: ORIGIN, depth: 2, pastedLinks: [], retainedUrls, reviewCeiling: 2 })
    expect(limited.reviewUrls).toEqual([ORIGIN, retainedUrls[0]])
    expect(limited.truncated).toBe(true)
  })
  it('keeps the supplied primary fragment and groups newly discovered variants after admitted obligations', () => {
    const pastedUrl = ORIGIN + 'app#start', retainedUrls = [ORIGIN + 'pricing/']
    expect(planReviewTargets({ pastedUrl, depth: 1, pastedLinks: [] }).reviewUrls).toEqual([pastedUrl])
    const plan = planReviewTargets({ pastedUrl, depth: 2, retainedUrls, pastedLinks: [
      { href: '/pricing?utm_campaign=launch', text: 'Pricing' }, { href: '/pricing/', text: 'Other pricing link' },
      { href: '/app#reset', text: 'Reset' },
    ] })
    expect(plan.reviewUrls).toEqual([pastedUrl, ...retainedUrls])
    expect(plan.truncated).toBe(false)
  })
  it('retains observed pages before new discovery without exceeding the existing depth and ceiling', () => {
    const retainedUrls = ['https://example.com/old-pricing', 'https://www.example.com/flow?mode=original#step']
    const plan = planReviewTargets({ pastedUrl: ORIGIN, depth: 2, pastedLinks: LINKS, retainedUrls, reviewCeiling: 3 })
    expect(plan.reviewUrls).toEqual([ORIGIN, ...retainedUrls])
    expect(plan.truncated).toBe(true)
    expect(planReviewTargets({ pastedUrl: ORIGIN, depth: 1, pastedLinks: LINKS, retainedUrls }).reviewUrls).toEqual([ORIGIN])
    expect(monitoringReviewUrls(ORIGIN, retainedUrls)).toEqual([ORIGIN, ...retainedUrls])
  })
  it('excludes foreign, malformed, credential-bearing and non-page history, retaining a bounded navigation cohort', () => {
    const recorded = ['https://foreign.test/page', 'https://secret:password@example.com/', 'javascript:alert(1)', '/relative',
      'https://example.com/manual.pdf', 'https://other.example.com/', 'https://example.com/pricing', 'https://example.com/pricing']
    expect(monitoringReviewUrls(ORIGIN, recorded)).toEqual([ORIGIN, 'https://example.com/pricing'])
    expect(monitoringReviewUrls(ORIGIN, Array.from({ length: 50 }, (_, index) => 'https://example.com/p' + index))).toHaveLength(24)
  })
  it('keeps Free and anonymous at this page only', () => {
    const plan = planReviewTargets({
      pastedUrl: ORIGIN,
      depth: 1,
      pastedLinks: LINKS,
    })
    expect(plan.reviewUrls).toEqual(['https://example.com/'])
    expect(plan.openCheckUrls.length).toBeGreaterThan(0)
  })

  it('reviews linked pages for Pro without expanding a second full-review level', () => {
    const plan = planReviewTargets({
      pastedUrl: ORIGIN,
      depth: 2,
      pastedLinks: LINKS,
      linkedPageLinks: [
        { pageUrl: 'https://example.com/pricing', links: [{ href: '/enterprise', text: 'Enterprise' }] },
      ],
    })
    expect(plan.reviewUrls).toContain('https://example.com/pricing')
    expect(plan.reviewUrls).not.toContain('https://example.com/enterprise')
    expect(plan.openCheckUrls).not.toContain('https://example.com/enterprise')
  })

  it('reviews one level beyond on Studio and open-checks linked pages', () => {
    const plan = planReviewTargets({
      pastedUrl: ORIGIN,
      depth: 3,
      pastedLinks: LINKS,
      linkedPageLinks: [
        { pageUrl: 'https://example.com/pricing', links: [{ href: '/enterprise', text: 'Enterprise' }] },
      ],
    })
    expect(plan.reviewUrls).toContain('https://example.com/enterprise')
    expect(plan.openCheckUrls).toContain('https://example.com/enterprise')
  })

  it('ranks conversion pages ahead of legal footer links even when legal comes first in the DOM', () => {
    const ranked = rankDestinations(collectEligibleDestinations(ORIGIN, LINKS))
    const paths = ranked.map((item) => item.canonical.pathname)
    expect(paths.indexOf('/checkout')).toBeLessThan(paths.indexOf('/privacy'))
    expect(paths.indexOf('/pricing')).toBeLessThan(paths.indexOf('/privacy'))
    expect(classifyImportanceBand('/privacy', 'Privacy')).toBe('legal-footer')
  })

  it('marks the plan truncated when the internal ceiling drops eligible pages', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      href: `/p${index}`,
      text: `Page ${index}`,
    }))
    const plan = planReviewTargets({
      pastedUrl: ORIGIN,
      depth: 2,
      pastedLinks: many,
      reviewCeiling: 5,
    })
    expect(plan.reviewUrls).toHaveLength(5)
    expect(plan.truncated).toBe(true)
  })

  it('scales the deadline with depth', () => {
    expect(auditDeadlineMsForDepth(1)).toBe(AUDIT_DEADLINE_MS)
    expect(auditDeadlineMsForDepth(3)).toBeGreaterThan(auditDeadlineMsForDepth(2))
    expect(asReviewDepth(2)).toBe(2)
    expect(asReviewDepth(9)).toBe(1)
  })

  it('builds coverage with linked pages excluding the pasted page', () => {
    const coverage = buildReviewCoverage({
      reviewedPageCount: 5,
      openCheckCount: 24,
      partial: true,
    })
    expect(coverage).toEqual({
      reviewedPageCount: 5,
      linkedPageCount: 4,
      openCheckCount: 24,
      partial: true,
    })
  })
})
