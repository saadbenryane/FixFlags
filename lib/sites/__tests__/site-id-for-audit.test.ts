import { describe, expect, it, vi, beforeEach } from 'vitest'
import { customerSiteIdForAudit } from '@/lib/sites/site-id-for-audit'

const prismaMock = vi.hoisted(() => ({
  provisionalSite: { findFirst: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

describe('customerSiteIdForAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses the owned Project id', async () => {
    await expect(
      customerSiteIdForAudit({ id: 'audit_1', projectId: 'proj_1' })
    ).resolves.toBe('proj_1')
    expect(prismaMock.provisionalSite.findFirst).not.toHaveBeenCalled()
  })

  it('returns the provisional p_ id instead of projectId', async () => {
    prismaMock.provisionalSite.findFirst.mockResolvedValue({ id: 'abc' })
    await expect(
      customerSiteIdForAudit({ id: 'audit_1', projectId: null })
    ).resolves.toBe('p_abc')
  })
})
