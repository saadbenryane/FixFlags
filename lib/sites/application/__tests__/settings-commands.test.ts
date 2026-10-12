import { beforeEach, describe, expect, it, vi } from 'vitest'
import { removeSite, saveSiteSettings } from '../settings-commands'
const db = vi.hoisted(() => ({ lock: vi.fn(), updateMany: vi.fn(), update: vi.fn(), accounts: vi.fn(), messages: vi.fn(), shops: vi.fn(), deleted: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $transaction: (run: (tx: unknown) => unknown) => run({
  $queryRaw: db.lock, project: { updateMany: db.updateMany, update: db.update },
  siteTestAccount: { findMany: db.accounts, deleteMany: db.deleted }, siteAccountMessage: { deleteMany: db.messages }, shopifyShop: { updateMany: db.shops },
}) } }))
const owner = { projectId: 'project', userId: 'owner' }
beforeEach(() => { vi.clearAllMocks(); db.lock.mockResolvedValue([{ id: 'project' }]); db.updateMany.mockResolvedValue({ count: 1 }); db.accounts.mockResolvedValue([]) })
describe('tenant-scoped Site lifecycle commands', () => {
  it('requires the current owner for settings and does not clear messages for a foreign Site', async () => {
    db.updateMany.mockResolvedValue({ count: 0 })
    await expect(saveSiteSettings(owner, { accountChecksEnabled: false })).rejects.toMatchObject({ status: 404 })
    expect(db.messages).not.toHaveBeenCalled()
    expect(db.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'project', userId: 'owner', deletedAt: null } }))
  })
  it('refuses removal while unreviewed accounts remain', async () => {
    db.accounts.mockResolvedValue([{ email: 'checks+1@example.com', state: 'ACTIVE' }])
    await expect(removeSite(owner)).rejects.toMatchObject({ status: 409, code: 'TEST_ACCOUNTS_REMAIN' })
    expect(db.update).not.toHaveBeenCalled(); expect(db.shops).not.toHaveBeenCalled()
  })
  it('refuses a stale acknowledgement when an account changed or was added', async () => {
    db.accounts.mockResolvedValue([{ email: 'checks+1@example.com', state: 'VERIFYING' }])
    await expect(removeSite(owner, { acknowledgeRemainingAccounts: true, remainingAccounts: [{ email: 'checks+1@example.com', state: 'RESERVED' }] }))
      .rejects.toMatchObject({ code: 'TEST_ACCOUNTS_CHANGED' })
    expect(db.update).not.toHaveBeenCalled()
  })
  it('removes an acknowledged Site without certifying account deletion and fences queued work', async () => {
    const remainingAccounts = [{ email: 'checks+1@example.com', state: 'ACTIVE' as const }]
    db.accounts.mockResolvedValue(remainingAccounts)
    expect(await removeSite(owner, { acknowledgeRemainingAccounts: true, remainingAccounts })).toEqual({ ok: true })
    expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      deletedAt: expect.any(Date), accountChecksEnabled: false, accountCheckRevision: { increment: 1 }, watchInterval: null,
    }) }))
    expect(db.deleted).not.toHaveBeenCalled()
    expect(db.messages).toHaveBeenCalledWith({ where: { account: { projectId: 'project' } } })
  })
  it('does not inspect accounts or mutate another owner’s Site', async () => {
    db.lock.mockResolvedValue([])
    await expect(removeSite(owner)).rejects.toMatchObject({ status: 404 })
    expect(db.accounts).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled()
  })
})
