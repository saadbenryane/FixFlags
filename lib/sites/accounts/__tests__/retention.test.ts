import { describe, expect, it, vi } from 'vitest'
import { deleteExpiredAccountMessages } from '../retention'
const remove = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: { siteAccountMessage: { deleteMany: remove } } }))
describe('independent account-message retention', () => {
  it('purges only expired tokens without needing an enabled account or mailbox', async () => {
    const now = new Date('2026-10-12T12:00:00Z')
    remove.mockResolvedValue({ count: 3 })
    expect(await deleteExpiredAccountMessages(now)).toBe(3)
    expect(remove).toHaveBeenCalledWith({ where: { expiresAt: { lte: now } } })
  })
})
