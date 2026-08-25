import { Prisma } from '@prisma/client'
import { projectLimitForPlan } from '@/lib/billing/plans'

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
    select: { plan: true },
  })
  if (!user) throw new Error('Account not found')

  const limit = projectLimitForPlan(user.plan)
  if (limit === null) return

  const count = await tx.project.count({ where: { userId } })
  if (count >= limit) throw new ProductLimitReached(limit)
}
