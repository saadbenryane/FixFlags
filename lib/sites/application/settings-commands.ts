import { prisma } from '@/lib/db'
import { z } from 'zod'
import { SiteRunRefusal } from './run-refusal'
import { SiteNotFound } from '../domain/site-errors'
import { accountStateSchema } from '../accounts/contracts'
import { ACCOUNT_CHECK_COPY as C } from '@/lib/marketing/copy/account-checks'
import { cancelSiteExecutions } from './cancel-executions'
import { canonicalProductHost } from '@/lib/audit/product-intelligence'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { productTransaction } from '@/lib/billing/product-transaction'
import { reconcileEditedUptimeTarget } from '@/lib/uptime/monitor-target'
import { retargetDefaultAvailability } from './default-availability-target'
import { withdrawResearchConsentForSiteRemoval } from '@/lib/growth/research-consent'
import type { Project } from '@prisma/client'

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

export async function updateOwnedSiteIdentity(owner: Owner, input: { name?: string; origin?: string }) {
  return productTransaction(async tx => {
    const where = { id: owner.projectId, userId: owner.userId, deletedAt: null }
    const current = await tx.project.findFirst({ where, select: { url: true, canonicalHost: true } })
    if (!current) throw new SiteRunRefusal('Project not found', 404, 'NOT_FOUND')
    if (input.origin !== undefined && canonicalProductHost(input.origin) !== current.canonicalHost)
      throw new SiteRunRefusal('A Project hostname cannot be changed; create the other Product instead', 409, 'PROJECT_HOST_MISMATCH')
    const saved = await tx.project.update({ where: { ...where, canonicalHost: current.canonicalHost },
      data: { ...(input.name !== undefined ? { name: input.name } : {}), ...(input.origin !== undefined ? { url: input.origin } : {}) } })
    return reconcileEditedSiteTarget(tx, current.url, saved)
  })
}

/** Both monitoring paths follow the saved identity in the same transaction. */
export async function reconcileEditedSiteTarget(tx: Transaction, previousUrl: string | undefined, site: Project) {
  if (previousUrl === undefined || previousUrl === site.url) return site
  const before = normalizeAuditNavigationUrl(previousUrl), after = normalizeAuditNavigationUrl(site.url)
  if (!after.ok || before.ok && before.url === after.url) return site
  const current = await tx.project.update({ where: { id: site.id }, data: {
    watchTargetRevision: { increment: 1 }, watchLeaseUntil: null, watchLastRunAt: null,
    ...(site.watchInterval && site.watchNextRunAt && !site.watchPausedAt ? {
      watchNextRunAt: new Date(), watchConsecutiveFailures: 0, watchLastError: null,
    } : {}),
  } })
  await retargetDefaultAvailability(tx, current)
  return reconcileEditedUptimeTarget(tx, previousUrl, current)
}

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
    if (result.count !== 1) throw new SiteNotFound()
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
    if (!projects.length) throw new SiteNotFound()
    const accounts = await tx.siteTestAccount.findMany({ where: { projectId: owner.projectId, state: { not: 'DELETED' } }, select: { email: true, state: true } })
    if (accounts.length && !acknowledgement.acknowledgeRemainingAccounts)
      throw new SiteRunRefusal(C.removalRequired, 409, 'TEST_ACCOUNTS_REMAIN')
    if (accounts.length && accountSnapshot(accounts) !== accountSnapshot(acknowledgement.remainingAccounts ?? []))
      throw new SiteRunRefusal(C.removalChanged, 409, 'TEST_ACCOUNTS_CHANGED')
    await withdrawResearchConsentForSiteRemoval(tx, owner)
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
