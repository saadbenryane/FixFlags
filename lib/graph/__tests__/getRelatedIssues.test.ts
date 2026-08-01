import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    issue: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { getRelatedIssues } from '@/lib/graph/related'

describe('getRelatedIssues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when current issue is not found', async () => {
    prismaMock.issue.findFirst.mockResolvedValue(null)

    const result = await getRelatedIssues('nonexistent-check')
    expect(result).toEqual([])
    expect(prismaMock.issue.findFirst).toHaveBeenCalledWith({
      where: { checkId: 'nonexistent-check' },
      orderBy: { siteCount: 'desc' },
      select: { rubric: true, id: true },
    })
  })

  it('returns same-rubric issues when enough exist', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      rubric: 'MESSAGE',
      id: 'issue_1',
    })

    prismaMock.issue.findMany.mockResolvedValue([
      { checkId: 'cta-vague', problemTemplate: 'CTA stays vague', siteCount: 10 },
      { checkId: 'audience-not-named', problemTemplate: 'Audience never named', siteCount: 8 },
      { checkId: 'outcome-buried', problemTemplate: 'Outcome buried below fold', siteCount: 6 },
    ])

    const result = await getRelatedIssues('hero-value-unclear')

    expect(result).toHaveLength(3)
    expect(result[0].title).toBe('CTA stays vague')
    expect(result[0].reason).toBe('Same Message rubric')
    expect(result[0].href).toBe('/issues/cta-vague')
    expect(result[0].siteCount).toBe(10)
    expect(result[1].href).toBe('/issues/audience-not-named')
    expect(result[2].href).toBe('/issues/outcome-buried')

    expect(prismaMock.issue.findMany).toHaveBeenCalledWith({
      where: {
        rubric: 'MESSAGE',
        checkId: { not: 'hero-value-unclear' },
        siteCount: { gte: 3 },
      },
      orderBy: { siteCount: 'desc' },
      take: 3,
      select: { checkId: true, problemTemplate: true, siteCount: true },
    })

    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('falls back to shared technology when fewer than 3 same-rubric', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      rubric: 'EXPERIENCE',
      id: 'issue_2',
    })

    prismaMock.issue.findMany.mockResolvedValue([
      { checkId: 'mobile-lcp-critical', problemTemplate: 'Mobile LCP is slow', siteCount: 15 },
    ])

    prismaMock.$queryRaw.mockResolvedValue([
      { checkId: 'security-headers-missing', problemTemplate: 'Security headers missing', siteCount: 20 },
    ])

    const result = await getRelatedIssues('color-contrast-poor')

    expect(result).toHaveLength(2)
    expect(result[0].href).toBe('/issues/mobile-lcp-critical')
    expect(result[0].reason).toBe('Same Experience rubric')
    expect(result[1].href).toBe('/issues/security-headers-missing')
    expect(result[1].reason).toBe('Shared technology stack')

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('deduplicates when shared-tech returns already-listed issue', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      rubric: 'REACH',
      id: 'issue_3',
    })

    prismaMock.issue.findMany.mockResolvedValue([
      { checkId: 'slow-3g-blank-screen', problemTemplate: 'Blank screen on 3G', siteCount: 20 },
      { checkId: 'mobile-lcp-critical', problemTemplate: 'Slow LCP on mobile', siteCount: 18 },
    ])

    prismaMock.$queryRaw.mockResolvedValue([
      { checkId: 'slow-3g-blank-screen', problemTemplate: 'Blank screen on 3G', siteCount: 20 },
      { checkId: 'skip-link-missing', problemTemplate: 'No skip link', siteCount: 12 },
    ])

    const result = await getRelatedIssues('render-blocking-resources')

    expect(result).toHaveLength(3)
    expect(result[0].href).toBe('/issues/slow-3g-blank-screen')
    expect(result[1].href).toBe('/issues/mobile-lcp-critical')
    expect(result[2].href).toBe('/issues/skip-link-missing')
  })

  it('returns empty array when no issues exist at all (same rubric returns nothing, no shared tech)', async () => {
    prismaMock.issue.findFirst.mockResolvedValue({
      rubric: 'MESSAGE',
      id: 'issue_4',
    })

    prismaMock.issue.findMany.mockResolvedValue([])
    prismaMock.$queryRaw.mockResolvedValue([])

    const result = await getRelatedIssues('unique-issue')

    expect(result).toHaveLength(0)
  })
})
