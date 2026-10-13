vi.mock('@/lib/growth/research-permissions', () => ({ hasCurrentResearchPermissions: vi.fn().mockResolvedValue(true) }))
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { researchFixture } from './fixtures/public-research'
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { growthArtifact: { findUnique } } }))
import { getIndexableIssueCheckIds } from '../queries'
import { PUBLIC_RESEARCH_KIND } from '../public-research'

describe('research sitemap eligibility', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-13T00:00:00Z')) })
  afterEach(() => vi.useRealTimers())
  it('uses the observation date and counts from the approved release', async () => {
    findUnique.mockResolvedValue({ kind: PUBLIC_RESEARCH_KIND, payload: researchFixture() })
    expect(await getIndexableIssueCheckIds()).toEqual([{ checkId: 'security-headers-missing', siteCount: 25, lastSeenAt: new Date('2026-09-30T00:00:00Z') }])
  })
  it('excludes the whole release if any check is a page variant', async () => {
    const payload = researchFixture()
    payload.issues[0].checkId += '::page:1'
    findUnique.mockResolvedValue({ kind: PUBLIC_RESEARCH_KIND, payload })
    expect(await getIndexableIssueCheckIds()).toEqual([])
  })
  it('does not advertise an expired dataset', async () => {
    findUnique.mockResolvedValue({ kind: PUBLIC_RESEARCH_KIND, payload: researchFixture() })
    vi.setSystemTime(new Date('2026-11-01T00:00:00Z'))
    expect(await getIndexableIssueCheckIds()).toEqual([])
  })
})
