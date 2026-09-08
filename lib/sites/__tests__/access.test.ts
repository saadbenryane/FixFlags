import { describe, expect, it, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  provisionalSite: { findUnique: vi.fn() },
}))
const loadSiteRecord = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord }))

import { resolveSiteAccess } from '@/lib/sites/access'

describe('resolveSiteAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows the project owner and denies strangers', async () => {
    loadSiteRecord.mockResolvedValue({
      siteId: 'proj_1',
      kind: 'project',
      userId: 'u1',
      provisionalSiteId: null,
      projectId: 'proj_1',
    })

    await expect(
      resolveSiteAccess('proj_1', { userId: 'u1' })
    ).resolves.toMatchObject({ ok: true, role: 'owner' })

    await expect(
      resolveSiteAccess('proj_1', { userId: 'u2' })
    ).resolves.toEqual({ ok: false, reason: 'denied' })

    await expect(
      resolveSiteAccess('proj_1', { userId: null, sessionKey: 'any' })
    ).resolves.toEqual({ ok: false, reason: 'denied' })
  })

  it('allows provisional Sites only for matching session or claimed audit cookie', async () => {
    loadSiteRecord.mockResolvedValue({
      siteId: 'p_abc',
      kind: 'provisional',
      userId: null,
      provisionalSiteId: 'abc',
      projectId: null,
      primaryAuditId: 'audit-1',
    })
    prismaMock.provisionalSite.findUnique.mockResolvedValue({
      sessionKey: 'client-1',
      primaryAuditId: 'audit-1',
      claimedProjectId: null,
    })

    await expect(
      resolveSiteAccess('p_abc', { sessionKey: 'client-1' })
    ).resolves.toMatchObject({ ok: true, role: 'provisional_session' })

    await expect(
      resolveSiteAccess('p_abc', { anonAuditIds: ['audit-1'] })
    ).resolves.toMatchObject({ ok: true, role: 'provisional_session' })

    await expect(
      resolveSiteAccess('p_abc', { sessionKey: 'other', anonAuditIds: [] })
    ).resolves.toEqual({ ok: false, reason: 'denied' })
  })

  it('returns not_found when the Site is missing', async () => {
    loadSiteRecord.mockResolvedValue(null)
    await expect(resolveSiteAccess('missing', {})).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    })
  })
})
