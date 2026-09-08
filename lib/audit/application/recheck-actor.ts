import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { claimsAnonymousReport } from '@/lib/audit/usage'

export type RecheckActor = {
  user: User | null
  claimedAnonymous: boolean
}

/** Resolve the durable actor once before the update-review command runs. */
export async function resolveRecheckActor(input: {
  parentReportId: string
  sessionUserId: string | null
  claimedAnonymousIds: string[]
}): Promise<RecheckActor> {
  const [parent, user] = await Promise.all([
    prisma.audit.findUnique({
      where: { id: input.parentReportId },
      select: { userId: true, parentId: true },
    }),
    input.sessionUserId
      ? prisma.user.findUnique({ where: { id: input.sessionUserId } })
      : Promise.resolve(null),
  ])

  return {
    user,
    claimedAnonymous:
      Boolean(parent) &&
      parent!.userId === null &&
      claimsAnonymousReport(
        input.claimedAnonymousIds,
        input.parentReportId,
        parent!.parentId
      ),
  }
}
