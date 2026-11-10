import { Prisma } from '@prisma/client'
import { loadEffectiveEntitlements } from './effective-entitlements'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'

export class ProductLimitReached extends Error {
  constructor(readonly limit: number) {
    super(`Product limit reached (${limit})`)
    this.name = 'ProductLimitReached'
  }
}

/** Enforce the plan against every distinct Product hostname for the account. */
export async function assertCanCreateProduct(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`fixflags:product-capacity:${userId}`}, 0)
    )
  `

  const policy = await loadEffectiveEntitlements(userId, tx)
  if(!policy || !policy.available) throw new Error('This account cannot create Sites.')
  const limit = policy.maxSites
  if (limit === null) return

  const count = await tx.project.count({ where: { userId, deletedAt: null } })
  if (count >= limit) {
    // Record outside the admission transaction so refusal does not erase intent.
    await recordSiteLifecycleEvent({ name: 'site_capacity_reached', idempotencyKey: `site-capacity:${randomUUID()}`, userId, properties: { limit } }).catch(() => undefined)
    throw new ProductLimitReached(limit)
  }
}

/**
 * Read-only view of the same capacity rule, for pages that offer adding a Site.
 * Admission still runs through assertCanCreateProduct; this only lets a page
 * stop offering an action the plan will refuse.
 */
export async function loadSiteCapacity(userId: string): Promise<{ limit: number | null; used: number; atLimit: boolean }> {
  const [policy, used] = await Promise.all([
    loadEffectiveEntitlements(userId),
    prisma.project.count({ where: { userId, deletedAt: null } }),
  ])
  const limit = policy?.available ? policy.maxSites : 0
  return { limit, used, atLimit: limit !== null && used >= limit }
}
