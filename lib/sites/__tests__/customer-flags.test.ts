import { describe, expect, it, vi } from 'vitest'
import { isCustomerFlag } from '@/lib/audit/attention'
import { loadSiteFlags, loadSiteRecommendations } from '../flags'
import type { SiteRecord } from '../types'

const prisma = vi.hoisted(() => ({
  flag: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: { flag: prisma.flag, improvement: { findMany: vi.fn().mockResolvedValue([]) }, audit: { findFirst: vi.fn() } } }))

const site = { kind: 'provisional', primaryAuditId: 'audit-1' } as SiteRecord

describe('customer Flag projector on Site load', () => {
  it('keeps broken contact as a Flag and optional SEO meta as a Recommendation', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-contact',
        checkId: 'form-contact-submit-failed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Contact form does not send',
        evidence: 'Submit returned 500',
        whyItMatters: 'Visitors cannot reach you',
        fix: 'Fix the form endpoint',
        pageUrl: 'https://example.com/contact',
        status: 'OPEN',
      },
      {
        id: 'flag-title',
        checkId: 'title-too-long',
        rubric: 'REACH',
        severity: 'IMPORTANT',
        impactTag: 'SEO',
        problem: 'Title tag is too long',
        evidence: 'title length 80',
        whyItMatters: 'Snippets may truncate',
        fix: 'Shorten the title',
        pageUrl: 'https://example.com/about',
        status: 'OPEN',
      },
    ])

    expect(isCustomerFlag({ checkId: 'form-contact-submit-failed', impactTag: 'CONVERSION', severity: 'IMPORTANT' })).toBe(true)
    expect(isCustomerFlag({ checkId: 'title-too-long', impactTag: 'SEO', severity: 'IMPORTANT' })).toBe(false)

    const flags = await loadSiteFlags(site)
    const recommendations = await loadSiteRecommendations(site)
    expect(flags.map((flag) => flag.id)).toEqual(['flag-contact'])
    expect(recommendations.map((flag) => flag.id)).toEqual(['flag-title'])
  })

  it('drops a stored slow-action Flag when the same page has no primary action', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-missing',
        checkId: 'journey-first-visit-hidden-cta',
        rubric: 'EXPERIENCE',
        severity: 'CRITICAL',
        impactTag: 'CONVERSION',
        problem: 'No obvious primary CTA on first visit',
        evidence: 'No primary action stands out.',
        whyItMatters: 'People have nothing clear to do next.',
        fix: 'Add one primary action.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
      {
        id: 'flag-slow',
        checkId: 'slow-3g-cta-delayed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
        evidence: 'The primary CTA was not detected.',
        whyItMatters: 'People leave before they can act.',
        fix: 'Render the action in the first HTML.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
    ])

    const flags = await loadSiteFlags(site)
    expect(flags.map((flag) => flag.checkId)).toEqual(['journey-first-visit-hidden-cta'])
  })

  it('keeps a slow-action Flag when a primary action was found', async () => {
    prisma.flag.findMany.mockResolvedValue([
      {
        id: 'flag-slow',
        checkId: 'slow-3g-cta-delayed',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
        evidence: 'The primary CTA became visible after 9000ms.',
        whyItMatters: 'People leave before they can act.',
        fix: 'Render the action in the first HTML.',
        pageUrl: 'https://example.org/',
        status: 'OPEN',
      },
    ])

    const flags = await loadSiteFlags(site)
    expect(flags.map((flag) => flag.id)).toEqual(['flag-slow'])
  })
})
