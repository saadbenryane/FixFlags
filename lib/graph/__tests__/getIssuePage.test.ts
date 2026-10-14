vi.mock('@/lib/growth/research-permissions', () => ({ hasCurrentResearchPermissions: vi.fn().mockResolvedValue(true) }))
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { researchFixture } from './fixtures/public-research'

const { prismaMock } = vi.hoisted(() => ({ prismaMock: {
  growthArtifact: { findUnique: vi.fn() },
  issue: { findFirst: vi.fn(), findMany: vi.fn() },
  benchmarkSnapshot: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
} }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
import { getIssuePage, getPublicIssueLibrary, getBenchmark, getTopIssuesForChecks } from '../queries'
import { PUBLIC_RESEARCH_KIND, PUBLIC_RESEARCH_PATH } from '../public-research'
import { hasCurrentResearchPermissions } from '@/lib/growth/research-permissions'

describe('public issue research boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-13T00:00:00Z'))
    vi.mocked(hasCurrentResearchPermissions).mockResolvedValue(true)
    prismaMock.growthArtifact.findUnique.mockResolvedValue({ kind: PUBLIC_RESEARCH_KIND, payload: researchFixture() })
  })
  afterEach(() => vi.useRealTimers())

  it('projects reviewed aggregates without identifiers, approval references, or raw graph reads', async () => {
    const result = await getIssuePage('security-headers-missing')
    expect(result).toMatchObject({ siteCount: 25, occurrenceCount: 42, examples: [], topFrameworks: [{ name: 'Next.js', siteCount: 20 }] })
    expect(result?.research.methodology).toContain('not population prevalence')
    expect(JSON.stringify(result)).not.toContain('synthetic-test-permission')
    expect(JSON.stringify(result)).not.toContain('copyReviewRef')
    expect(prismaMock.growthArtifact.findUnique).toHaveBeenCalledWith({ where: { path: PUBLIC_RESEARCH_PATH }, select: { kind: true, payload: true } })
    expect(prismaMock.issue.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.issue.findMany).not.toHaveBeenCalled()
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns no detail for unknown or page-scoped checks', async () => {
    expect(await getIssuePage('missing-check')).toBeNull()
    expect(await getIssuePage('security-headers-missing::page:1')).toBeNull()
  })

  it('withholds previously approved data when its current permission check fails', async () => {
    vi.mocked(hasCurrentResearchPermissions).mockResolvedValue(false)
    expect(await getPublicIssueLibrary()).toEqual([])
    expect(await getIssuePage('security-headers-missing')).toBeNull()
    expect(await getTopIssuesForChecks(['security-headers-missing'])).toEqual([])
  })

  it.each([
    ['missing', null],
    ['wrong kind', { kind: 'legacy-graph', payload: researchFixture() }],
    ['unapproved', { kind: PUBLIC_RESEARCH_KIND, payload: { ...researchFixture(), status: 'draft' } }],
    ['expired', { kind: PUBLIC_RESEARCH_KIND, payload: { ...researchFixture(), expiresAt: '2026-10-12T00:00:00Z' } }],
    ['unknown identifiers', { kind: PUBLIC_RESEARCH_KIND, payload: { ...researchFixture(), hostname: 'private.example.com' } }],
  ])('fails closed for a %s release', async (_name, row) => {
    prismaMock.growthArtifact.findUnique.mockResolvedValue(row)
    expect(await getPublicIssueLibrary()).toEqual([])
    expect(await getIssuePage('security-headers-missing')).toBeNull()
  })

  it('does not expose legacy benchmarks without a permitted-use contract', async () => {
    expect(await getBenchmark('framework:nextjs')).toBeNull()
    expect(prismaMock.benchmarkSnapshot.findFirst).not.toHaveBeenCalled()
  })

  it('limits top-issue previews to the same approved dataset', async () => {
    expect(await getTopIssuesForChecks(['security-headers-missing'])).toEqual([
      { checkId: 'security-headers-missing', rubric: 'REACH', problemTemplate: 'Security headers are missing', siteCount: 25 },
    ])
    expect(await getTopIssuesForChecks(['security-headers-missing'], 26)).toEqual([])
    expect(await getTopIssuesForChecks(['private-check'])).toEqual([])
  })
})
