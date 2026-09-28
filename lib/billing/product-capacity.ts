import { Prisma } from '@prisma/client'
import { siteCarePolicy } from '@/lib/sites/application/care-policy'

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

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, role: true },
  })
  if (!user) throw new Error('Account not found')

  // The Site cap is one product decision, read from the care policy. Enforcing it
  // here from a second re-derivation is how a plan and its limit drift apart.
  const limit = siteCarePolicy(user).maxSites
  if (limit === null) return

  const count = await tx.project.count({ where: { userId, deletedAt: null } })
  if (count >= limit) throw new ProductLimitReached(limit)
}
