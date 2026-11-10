import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({ audit: { findUnique: vi.fn(), findFirst: vi.fn() }, project: { updateMany: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: db }))
import { AI_OUTAGE_RECHECK_MS, scheduleAiOutageRecheck } from '../ai-outage-recheck'

const now = new Date('2026-11-10T21:00:00Z')
beforeEach(() => {
  vi.clearAllMocks()
  db.audit.findUnique.mockResolvedValue({ projectId: 'site', createdAt: new Date(now.getTime() - 60_000) })
  db.audit.findFirst.mockResolvedValue({ failureCode: null })
  db.project.updateMany.mockResolvedValue({ count: 1 })
})

describe('AI outage recheck', () => {
  it('brings the next monitored check forward to about an hour after a provider outage', async () => {
    expect(await scheduleAiOutageRecheck('audit', 'provider_exhausted', now)).toBe(true)
    const retryAt = new Date(now.getTime() + AI_OUTAGE_RECHECK_MS)
    expect(db.project.updateMany).toHaveBeenCalledWith({
      where: { id: 'site', deletedAt: null, watchPausedAt: null, watchInterval: { not: null }, watchNextRunAt: { gt: retryAt } },
      data: { watchNextRunAt: retryAt },
    })
  })

  it('retries once per outage, not after a check the provider already left partial', async () => {
    db.audit.findFirst.mockResolvedValue({ failureCode: 'AI_PROVIDER_REJECTED' })
    expect(await scheduleAiOutageRecheck('audit', 'provider_rejected', now)).toBe(false)
    expect(db.project.updateMany).not.toHaveBeenCalled()
  })

  it('ignores failures that are not provider outages and checks without a Site', async () => {
    expect(await scheduleAiOutageRecheck('audit', 'contract_invalid', now)).toBe(false)
    db.audit.findUnique.mockResolvedValue({ projectId: null, createdAt: now })
    expect(await scheduleAiOutageRecheck('audit', 'budget_unavailable', now)).toBe(false)
    expect(db.project.updateMany).not.toHaveBeenCalled()
  })
})
