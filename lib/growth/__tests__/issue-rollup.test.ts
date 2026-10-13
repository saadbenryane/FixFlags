import { beforeEach, describe, expect, it, vi } from 'vitest'
const { prismaMock } = vi.hoisted(() => ({ prismaMock: {
  issue: { updateMany: vi.fn() }, $queryRaw: vi.fn(),
} }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
import { runIssueRollup } from '@/lib/growth/issue-rollup'
describe('internal issue rollup', () => {
  beforeEach(() => vi.clearAllMocks())
  it('updates counters and clears identifiable examples without querying customer hostnames', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: 'security-headers-missing', occurrence_count: 11n, site_count: 3n, framework_count: 2n }])
    expect(await runIssueRollup()).toEqual({ issues: 1, examples: 0 })
    expect(prismaMock.issue.updateMany).toHaveBeenNthCalledWith(1, {
      where: { checkId: 'security-headers-missing' },
      data: { occurrenceCount: 11, siteCount: 3, frameworkCount: 2 },
    })
    expect(prismaMock.issue.updateMany).toHaveBeenLastCalledWith({ data: { examples: [] } })
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })
  it('clears stale examples even when there are no occurrences', async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    expect(await runIssueRollup()).toEqual({ issues: 0, examples: 0 })
    expect(prismaMock.issue.updateMany).toHaveBeenCalledWith({ data: { examples: [] } })
  })
})
