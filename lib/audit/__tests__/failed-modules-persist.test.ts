import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  audit: { update: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { persistAuditFailedModules } from '@/lib/audit/finalize'

describe('persistAuditFailedModules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('writes the deduplicated, sorted union of page failed modules', async () => {
    await persistAuditFailedModules('audit-1', [
      { failedModules: ['content'] },
      { failedModules: ['seo', 'content'] },
    ])
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { failedModules: ['content', 'seo'] },
    })
  })

  it('writes JsonNull when every page ran every module', async () => {
    await persistAuditFailedModules('audit-1', [{ failedModules: [] }, { failedModules: [] }])
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { failedModules: expect.anything() },
    })
    const { Prisma } = await import('@prisma/client')
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { failedModules: Prisma.JsonNull },
    })
  })
})
