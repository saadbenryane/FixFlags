import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SiteRunRefusal } from './run-refusal'
import { accountStateSchema } from '../accounts/contracts'
import { ACCOUNT_CHECK_COPY as C } from '@/lib/marketing/copy/account-checks'
import { cancelSiteExecutions } from './cancel-executions'

export const siteSettingsWriteSchema = z.object({
  notificationLevel: z.enum(['FLAGS', 'CRITICAL_ONLY', 'OFF']).optional(),
  notifyOnRecovery: z.boolean().optional(),
  accountChecksEnabled: z.boolean().optional(),
}).strict().refine(value => Object.keys(value).length > 0)

export const siteRemovalSchema = z.object({
  acknowledgeRemainingAccounts: z.literal(true).optional(),
  remainingAccounts: z.array(z.object({ email: z.string().email(), state: accountStateSchema }).strict()).max(100).optional(),
}).strict()

type Owner = { projectId: string; userId: string }
type Transaction = import('@prisma/client').Prisma.TransactionClient
async function settingsTransaction<T>(tx: Transaction | undefined, run: (client: Transaction) => Promise<T>): Promise<T> {
  return tx ? run(tx) : prisma.$transaction(run)
}
export async function saveSiteSettings(owner: Owner, input: z.infer<typeof siteSettingsWriteSchema>, transaction?: Transaction) {
  const changes = siteSettingsWriteSchema.parse(input)
  await settingsTransaction(transaction, async tx => {
    const result = await tx.project.updateMany({
      where: { id: owner.projectId, userId: owner.userId, deletedAt: null },
      data: { ...changes, ...(changes.accountChecksEnabled !== undefined ? { accountCheckRevision: { increment: 1 } } : {}) },
    })
    if (result.count !== 1) throw new SiteRunRefusal('Site not found.', 404)
    if (changes.accountChecksEnabled === false)
      await tx.siteAccountMessage.deleteMany({ where: { account: { projectId: owner.projectId } } })
    if (changes.accountChecksEnabled === true)
      await tx.siteTestAccount.deleteMany({ where: { projectId: owner.projectId, state: 'DELETED', purpose: 'retained' } })
  })
  return { ok: true as const, ...changes }
}

function accountSnapshot(accounts: Array<{ email: string; state: string }>) {
  return JSON.stringify(accounts.map(({ email, state }) => ({ email, state })).toSorted((a, b) => a.email.localeCompare(b.email)))
}

/** Serialize removal with account reservation, then fence all outstanding work.
 * Acknowledgement records the owner's decision; it never certifies deletion. */
export async function removeSite(owner: Owner, input: z.infer<typeof siteRemovalSchema> = {}, transaction?: Transaction) {
  const acknowledgement = siteRemovalSchema.parse(input)
  await settingsTransaction(transaction, async tx => {
    const projects = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "projects" WHERE "id" = ${owner.projectId}
        AND "userId" = ${owner.userId} AND "deletedAt" IS NULL FOR UPDATE`
    if (!projects.length) throw new SiteRunRefusal('Site not found.', 404)
    const accounts = await tx.siteTestAccount.findMany({ where: { projectId: owner.projectId, state: { not: 'DELETED' } }, select: { email: true, state: true } })
    if (accounts.length && !acknowledgement.acknowledgeRemainingAccounts)
      throw new SiteRunRefusal(C.removalRequired, 409, 'TEST_ACCOUNTS_REMAIN')
    if (accounts.length && accountSnapshot(accounts) !== accountSnapshot(acknowledgement.remainingAccounts ?? []))
      throw new SiteRunRefusal(C.removalChanged, 409, 'TEST_ACCOUNTS_CHANGED')
    await cancelSiteExecutions(tx, owner.projectId, new Date())
    await tx.shopifyShop.updateMany({ where: { projectId: owner.projectId }, data: { projectId: null, linkedAt: null } })
    await tx.project.update({ where: { id: owner.projectId }, data: {
      deletedAt: new Date(), isManaged: false,
      accountChecksEnabled: false, accountCheckRevision: { increment: 1 },
      watchInterval: null, watchEveryMinutes: null, watchNextRunAt: null,
      watchLeaseUntil: null, watchLastError: null, watchConsecutiveFailures: 0,
    } })
    await tx.siteAccountMessage.deleteMany({ where: { account: { projectId: owner.projectId } } })
  })
  return { ok: true as const }
}
