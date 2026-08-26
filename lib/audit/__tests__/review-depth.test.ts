import { describe, expect, it } from 'vitest'
import {
  asReviewDepth,
  auditDeadlineMsForDepth,
  classifyImportanceBand,
  planReviewTargets,
  rankDestinations,
  buildReviewCoverage,
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
