import type { PrismaClient } from '@prisma/client'

/** Fixture credentials follow the installed auth adapter's canonical user ID. */
export function ensureReleasePasswordAccount(db: PrismaClient, input: { userId: string; email: string; passwordHash: string }) {
  return db.$transaction(async tx => {
    const accounts = await tx.account.findMany({ where: { providerId: 'credential',
      accountId: { in: [input.userId, input.email] } }, select: { id: true, userId: true, accountId: true } })
    if (accounts.some(account => account.userId !== input.userId)) throw new Error('Fixture credential belongs to another user')
    const existing = accounts.find(account => account.accountId === input.userId) ?? accounts[0]
    const data = { accountId: input.userId, password: input.passwordHash }
    const credential = existing
      ? await tx.account.update({ where: { id: existing.id }, data })
      : await tx.account.create({ data: { ...data, userId: input.userId, providerId: 'credential' } })
    const obsolete = accounts.filter(account => account.id !== credential.id).map(account => account.id)
    if (obsolete.length) await tx.account.deleteMany({ where: { id: { in: obsolete }, userId: input.userId,
      providerId: 'credential', accountId: input.email } })
    return credential
  })
}
