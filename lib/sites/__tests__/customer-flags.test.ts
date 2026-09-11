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
})
