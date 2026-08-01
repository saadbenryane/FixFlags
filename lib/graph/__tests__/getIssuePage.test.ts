import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    issue: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { getIssuePage, MIN_SAMPLE_SIZE } from '@/lib/graph/queries'

describe('getIssuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when checkId is not found', async () => {
    prismaMock.issue.findFirst.mockResolvedValue(null)

    const result = await getIssuePage('missing-check')

    expect(result).toBeNull()
    expect(prismaMock.issue.findFirst).toHaveBeenCalledWith({
      where: { checkId: 'missing-check' },
      orderBy: [{ siteCount: 'desc' }, { lastSeenAt: 'desc' }],
    })
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns null when sample size is below MIN_SAMPLE_SIZE', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      checkId: 'slow-lcp-critical',
      rubric: 'EXPERIENCE',
      problemTemplate: 'Slow LCP',
      fixTemplate: 'Optimize assets',
      siteCount: MIN_SAMPLE_SIZE - 1,
      occurrenceCount: 1,
    })

    const result = await getIssuePage('slow-lcp-critical')

    expect(result).toBeNull()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns issue data with transformed examples and frameworks when threshold is met', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      checkId: 'security-headers-missing',
      rubric: 'REACH',
      problemTemplate: 'Security headers are missing',
      fixTemplate: 'Add CSP and X-Content-Type-Options',
      siteCount: MIN_SAMPLE_SIZE,
      occurrenceCount: 42,
    })

    prismaMock.$queryRaw
      .mockResolvedValueOnce([
        { name: 'Next.js', site_count: BigInt(12) },
        { name: 'React', site_count: BigInt(6) },
      ])
      .mockResolvedValueOnce([
        { hostname: 'www.example.com', pageRole: 'homepage', severity: 'high' },
        { hostname: 'docs.example.com', pageRole: 'article', severity: 'low' },
      ])

    const result = await getIssuePage('security-headers-missing')

    expect(result).not.toBeNull()
    expect(result?.rubric).toBe('REACH')
    expect(result?.topFrameworks).toEqual([
      { name: 'Next.js', siteCount: 12 },
      { name: 'React', siteCount: 6 },
    ])
    expect(result?.examples).toEqual([
      { hostname: 'example.com', pageRole: 'homepage', severity: 'high' },
      { hostname: 'docs.example.com', pageRole: 'article', severity: 'low' },
    ])
    expect(result?.siteCount).toBe(MIN_SAMPLE_SIZE)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)
  })
})
