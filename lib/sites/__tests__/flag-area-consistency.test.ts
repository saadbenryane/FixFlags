import { describe, expect, it, vi } from 'vitest'
import { loadSiteFlags } from '../flags'
import { cardAreaForCheck } from '../card-areas'
import type { SiteRecord } from '../types'

vi.mock('@/lib/db', () => ({ prisma: {
  improvement: { findMany: vi.fn().mockResolvedValue([{ id: 'imp', title: 'Page stays blank', fingerprint: 'old', status: 'PROPOSED', expectedBenefit: 'Visitors can read the page', recommendedChange: 'Reduce blocking resources' }]) },
  audit: { findFirst: vi.fn().mockResolvedValue(null) },
} }))

describe('persisted Flag area', () => {
  it('keeps measured slow-network failures in Performance despite conversion impact', () => {
    expect(cardAreaForCheck({ checkId: 'slow-3g-blank-screen', impactTag: 'CONVERSION', rubric: 'EXPERIENCE' })).toBe('performance')
  })
  it('places journey failures in Conversion even with an Experience rubric', () => {
    expect(cardAreaForCheck({ checkId: 'journey-funnel-dead-end', rubric: 'EXPERIENCE' })).toBe('conversion')
  })
  it('keeps unmatched improvements in the same area used by coverage', async () => {
    const flags = await loadSiteFlags({ kind: 'project', projectId: 'owned-site' } as SiteRecord)
    expect(flags[0].area).toBe('performance')
    expect(flags[0].area).toBe(cardAreaForCheck(flags[0]))
  })
})
