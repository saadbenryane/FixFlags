vi.mock('@/lib/growth/research-permissions', () => ({ hasCurrentResearchPermissions: vi.fn().mockResolvedValue(true) }))
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { researchFixture } from './fixtures/public-research'
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { growthArtifact: { findUnique } } }))
import { getRelatedIssues } from '../related'
import { PUBLIC_RESEARCH_KIND } from '../public-research'

describe('reviewed related issues', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T00:00:00Z')) })
  afterEach(() => vi.useRealTimers())
  it('prioritizes same-rubric issues, then approved framework overlap', async () => {
    const payload = researchFixture()
    payload.issues.push(
      { ...payload.issues[0], checkId: 'mobile-lcp-critical', rubric: 'EXPERIENCE', siteCount: 40, occurrenceCount: 45 },
      { ...payload.issues[0], checkId: 'skip-link-missing', topFrameworks: [] },
    )
    findUnique.mockResolvedValue({ kind: PUBLIC_RESEARCH_KIND, payload })
    expect(await getRelatedIssues('security-headers-missing')).toMatchObject([
      { href: '/issues/skip-link-missing', reason: 'Same Reach rubric' },
      { href: '/issues/mobile-lcp-critical', reason: 'Shared technology stack' },
    ])
    expect(await getRelatedIssues('unpublished-check')).toEqual([])
  })
  it('returns no links when the release is unavailable', async () => {
    findUnique.mockResolvedValue(null)
    expect(await getRelatedIssues('security-headers-missing')).toEqual([])
  })
})
