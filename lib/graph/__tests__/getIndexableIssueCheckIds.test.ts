import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { getIndexableIssueCheckIds } from '@/lib/graph/queries'

describe('getIndexableIssueCheckIds', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows ordered per query layer', async () => {
    const rows = [
      { checkId: 'mobile-lcp-critical', siteCount: 10, lastSeenAt: new Date('2026-07-20T10:00:00Z') },
      { checkId: 'security-headers-missing', siteCount: 8, lastSeenAt: new Date('2026-07-20T09:00:00Z') },
    ]

    prismaMock.$queryRaw.mockResolvedValue(rows)

    const result = await getIndexableIssueCheckIds()

    expect(result).toEqual(rows)
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('defensively excludes per-page check variants from public URLs', async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { checkId: 'cta-dead-link', siteCount: 8, lastSeenAt: new Date('2026-09-08T10:00:00Z') },
      { checkId: 'cta-dead-link::page:1', siteCount: 7, lastSeenAt: new Date('2026-09-08T09:00:00Z') },
    ])

    await expect(getIndexableIssueCheckIds()).resolves.toEqual([
      { checkId: 'cta-dead-link', siteCount: 8, lastSeenAt: new Date('2026-09-08T10:00:00Z') },
    ])
  })
})
