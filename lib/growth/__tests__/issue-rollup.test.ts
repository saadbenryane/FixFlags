import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    issue: {
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { runIssueRollup } from '@/lib/growth/issue-rollup'

describe('runIssueRollup', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recomputes issue aggregates and rebuilds examples', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'security-headers-missing',
          occurrence_count: BigInt(11),
          site_count: BigInt(3),
          framework_count: BigInt(2),
        },
        {
          id: 'mobile-lcp-critical',
          occurrence_count: BigInt(20),
          site_count: BigInt(5),
          framework_count: BigInt(4),
        },
      ])
      .mockResolvedValueOnce([
        { hostname: 'www.example.com', pageRole: 'homepage', severity: 'high' },
        { hostname: 'news.example.com', pageRole: 'article', severity: 'medium' },
      ])
      .mockResolvedValueOnce([
        { hostname: 'www.shop.example.com', pageRole: 'pricing', severity: 'medium' },
      ])

    prismaMock.issue.groupBy.mockResolvedValue([
      { checkId: 'security-headers-missing' },
      { checkId: 'mobile-lcp-critical' },
    ])

    const result = await runIssueRollup()

    expect(result).toEqual({ issues: 2, examples: 2 })

    expect(prismaMock.issue.updateMany).toHaveBeenNthCalledWith(1, {
      where: { checkId: 'security-headers-missing' },
      data: {
        occurrenceCount: 11,
        siteCount: 3,
        frameworkCount: 2,
      },
    })

    expect(prismaMock.issue.updateMany).toHaveBeenNthCalledWith(2, {
      where: { checkId: 'mobile-lcp-critical' },
      data: {
        occurrenceCount: 20,
        siteCount: 5,
        frameworkCount: 4,
      },
    })

    expect(prismaMock.issue.updateMany).toHaveBeenNthCalledWith(3, {
      where: { checkId: 'security-headers-missing' },
      data: {
        examples: [
          { hostname: 'example.com', pageRole: 'homepage', severity: 'high' },
          { hostname: 'news.example.com', pageRole: 'article', severity: 'medium' },
        ],
      },
    })

    expect(prismaMock.issue.updateMany).toHaveBeenNthCalledWith(4, {
      where: { checkId: 'mobile-lcp-critical' },
      data: {
        examples: [
          { hostname: 'shop.example.com', pageRole: 'pricing', severity: 'medium' },
        ],
      },
    })
  })
})
