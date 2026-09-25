import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  flagFindMany: vi.fn(),
  flagCreate: vi.fn(),
  reviewCreate: vi.fn(),
  findingUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    flag: { findMany: mocks.flagFindMany, create: mocks.flagCreate },
    journeyReview: { create: mocks.reviewCreate },
    journeyFinding: { updateMany: mocks.findingUpdate },
  },
}))

import {
  omitRepeatedCustomerFindings,
  persistJourneyResult,
} from '@/lib/audit/journey/run-journey-reviews'

const page = 'https://example.net/'
const missingStep = {
  checkId: 'journey-pricing-evaluation-hidden-cta',
  stepNumber: 1,
  url: page,
  rubric: 'EXPERIENCE' as const,
  severity: 'CRITICAL' as const,
  impactTag: 'CONVERSION' as const,
  problem: 'No obvious primary CTA on first visit',
  evidence: 'No primary action stands out on the first screen.',
  whyItMatters: 'People who arrive here have nothing clear to do next.',
  fix: 'Add one primary action above the fold.',
  confidence: 0.85,
}

describe('customer Flags from a page walk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.reviewCreate.mockResolvedValue({ id: 'review-1' })
    mocks.flagCreate.mockResolvedValue({ id: 'flag-1' })
    mocks.findingUpdate.mockResolvedValue({ count: 1 })
  })

  it('keeps one Flag when a later walk repeats the same missing action', async () => {
    expect(omitRepeatedCustomerFindings(
      [{ problem: missingStep.problem, pageUrl: page }],
      [missingStep],
    )).toEqual([])

    mocks.flagFindMany.mockResolvedValue([
      { problem: missingStep.problem, pageUrl: page },
    ])

    await persistJourneyResult('audit-1', {
      findings: [missingStep],
      steps: [],
      journeyType: 'pricing-evaluation',
      startUrl: page,
      status: 'ABANDONED',
      goalAchieved: false,
      blockedReason: null,
      abandonedReason: 'No suitable same-origin navigation target',
      durationMs: 10,
      formProbe: null,
      actionTimeline: [],
    })

    expect(mocks.flagCreate).not.toHaveBeenCalled()
  })

  it('records the first missing action and does not use the word journey', async () => {
    mocks.flagFindMany.mockResolvedValue([])
    await persistJourneyResult('audit-1', {
      findings: [missingStep],
      steps: [],
      journeyType: 'first-visit',
      startUrl: page,
      status: 'ABANDONED',
      goalAchieved: false,
      blockedReason: null,
      abandonedReason: null,
      durationMs: 10,
      formProbe: null,
      actionTimeline: [],
    })

    expect(mocks.flagCreate).toHaveBeenCalledTimes(1)
    const saved = mocks.flagCreate.mock.calls[0][0].data as { problem: string; whyItMatters: string }
    expect(saved.problem).toBe('No obvious primary CTA on first visit')
    expect(`${saved.problem} ${saved.whyItMatters}`.toLowerCase()).not.toContain('journey')
  })
})
