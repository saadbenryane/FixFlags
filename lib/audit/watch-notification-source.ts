import type { Audit, Prisma } from '@prisma/client'

/** Admission's pending marker becomes classification responsibility only after
 * Watch completes. Attempted deliveries retain their own separate receipt. */
export const watchNotificationSourceWhere = {
  status: 'COMPLETED', recheckTrigger: 'WATCH',
} as const satisfies Prisma.AuditWhereInput

export function isWatchNotificationSource(source: Pick<Audit, 'status' | 'recheckTrigger'>) {
  return source.status === watchNotificationSourceWhere.status &&
    source.recheckTrigger === watchNotificationSourceWhere.recheckTrigger
}
