import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

export async function requireActiveAccount(userId: string, db: Prisma.TransactionClient = prisma) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, lifecycleStatus: true },
  })
  if (!user || user.lifecycleStatus !== 'ACTIVE')
    throw new SiteRunRefusal('This account cannot start new work.', 403, 'ACCOUNT_UNAVAILABLE')
}

/** Serialize access issuance with suspension and erasure before creating credentials. */
export async function requireActiveAccountForWrite(
  tx: import('@prisma/client').Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT "id" FROM "users" WHERE "id"=${userId} AND "lifecycleStatus"='ACTIVE' FOR UPDATE`
  if (rows.length !== 1)
    throw new SiteRunRefusal('This account is unavailable.', 403, 'ACCOUNT_UNAVAILABLE')
}
