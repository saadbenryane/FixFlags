import type { Prisma } from '@prisma/client'

export function requiresAccountCleanup(project: { deletedAt: Date | null; accountChecksEnabled: boolean }) {
  return project.deletedAt !== null || !project.accountChecksEnabled
}

/** Healthy retained accounts need no intervention while their Site still permits account checks. */
export function accountsAwaitingAction(interrupted: Date): Prisma.SiteTestAccountWhereInput {
  return {
    state: { not: 'DELETED' },
    OR: [
      { project: { OR: [{ deletedAt: { not: null } }, { accountChecksEnabled: false }] } },
      { state: { in: ['SUBMITTING', 'VERIFYING', 'DELETING'] }, updatedAt: { lt: interrupted } },
    ],
  }
}
