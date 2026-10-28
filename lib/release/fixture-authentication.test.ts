import type { PrismaClient } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { ensureReleasePasswordAccount } from './fixture-authentication'
import { readReleaseFixtureConfig } from '../../scripts/provision-release-fixtures'

function database(accounts: Array<{ id: string; userId: string; accountId: string }>) {
  const tx = { account: { findMany: vi.fn(async () => accounts),
    update: vi.fn(async () => ({ id: 'canonical' })), create: vi.fn(), deleteMany: vi.fn() } }
  const db = { $transaction: (work: (client: typeof tx) => unknown) => work(tx) } as unknown as PrismaClient
  return { db, tx }
}

describe('release fixture credential custody', () => {
  it.each(['fixture-user', 'fixture@example.test'])('refuses another user at credential identity %s', async accountId => {
    const { db, tx } = database([{ id: 'foreign', userId: 'another-user', accountId }])
    await expect(ensureReleasePasswordAccount(db, { userId: 'fixture-user', email: 'fixture@example.test', passwordHash: 'fixture-hash' }))
      .rejects.toThrow('belongs to another user')
    expect(tx.account.update).not.toHaveBeenCalled()
    expect(tx.account.create).not.toHaveBeenCalled()
    expect(tx.account.deleteMany).not.toHaveBeenCalled()
  })

  it('retains the canonical account and retires only its own obsolete fixture alias', async () => {
    const { db, tx } = database([{ id: 'legacy', userId: 'fixture-user', accountId: 'fixture@example.test' },
      { id: 'canonical', userId: 'fixture-user', accountId: 'fixture-user' }])
    await ensureReleasePasswordAccount(db, { userId: 'fixture-user', email: 'fixture@example.test', passwordHash: 'fixture-hash' })
    expect(tx.account.update).toHaveBeenCalledWith({ where: { id: 'canonical' }, data: { accountId: 'fixture-user', password: 'fixture-hash' } })
    expect(tx.account.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['legacy'] }, userId: 'fixture-user',
      providerId: 'credential', accountId: 'fixture@example.test' } })
  })

  it('rejects a production database before requiring further provisioning inputs', () => {
    expect(() => readReleaseFixtureConfig({ RELEASE_ENV_URL: 'https://validation.example.test',
      RELEASE_WATCH_MAILBOX: 'validationalerts+fixture@fixflags.com',
      RELEASE_FRESH_DATABASE_URL: 'postgresql://fixture:fixture@db.example.test/railway' }))
      .toThrow('database name must include release or test')
  })
})
