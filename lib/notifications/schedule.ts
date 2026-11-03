import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { nextSummaryAt, readNotificationPreferences, summaryCadence } from './preferences'
import { monitored, dailyMonitoring } from './contracts'

/** Existing and newly created accounts acquire the same default. No historical
 * backlog is mailed: the first summary waits for the next local delivery slot. */
export async function scheduleSummaries(now: Date, limit: number) {
  const owners = await prisma.user.findMany({ where: { lifecycleStatus: 'ACTIVE', emailVerified: true,
    notificationPreference: null, projects: { some: monitored } }, select: { id: true }, orderBy: { id: 'asc' }, take: limit })
  for (const owner of owners) await prisma.$transaction(async tx => {
    if (!await lockSummaryOwner(tx, owner.id)) return
    await tx.notificationPreference.createMany({ data: [{ userId: owner.id }], skipDuplicates: true })
  })
  // Reconcile changed monitoring before the next summary becomes due. This is a
  // change query, so unchanged accounts cannot starve later accounts in the batch.
  const changed = await prisma.notificationPreference.findMany({ where: { cadence: 'FOLLOW_MONITORING',
    user: { lifecycleStatus: 'ACTIVE', emailVerified: true, projects: { some: monitored } },
    OR: [{ resolvedCadence: null }, { resolvedCadence: 'DAILY', user: { projects: { none: dailyMonitoring } } },
      { resolvedCadence: 'WEEKLY', user: { projects: { some: dailyMonitoring } } }],
  }, select: { userId: true, revision: true, hour: true, weekday: true, timeZone: true, cadence: true,
    user: { select: { projects: { where: monitored, select: { watchInterval: true, watchEveryMinutes: true } } } } },
  orderBy: { userId: 'asc' }, take: limit })
  for (const preference of changed) {
    const values = readNotificationPreferences(preference), resolvedCadence = summaryCadence(values, preference.user.projects)
    await prisma.$transaction(async tx => {
      if (!await lockSummaryOwner(tx, preference.userId)) return
      await tx.notificationPreference.updateMany({ where: { userId: preference.userId, revision: preference.revision },
        data: { resolvedCadence, nextSendAt: nextSummaryAt(values, resolvedCadence, now), revision: { increment: 1 } } })
    })
  }
  const preferences = await prisma.notificationPreference.findMany({ where: {
    cadence: { not: 'OFF' }, user: { lifecycleStatus: 'ACTIVE', emailVerified: true, projects: { some: monitored } },
    OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
  }, include: { user: { select: { projects: { where: monitored, select: { watchInterval: true, watchEveryMinutes: true } } } } },
  orderBy: [{ nextSendAt: 'asc' }, { userId: 'asc' }], take: limit })
  for (const preference of preferences) {
    const values = readNotificationPreferences(preference)
    const cadence = summaryCadence(values, preference.user.projects)
    const nextSendAt = nextSummaryAt(values, cadence, now)
    await prisma.$transaction(async tx => {
      if (!await lockSummaryOwner(tx, preference.userId)) return
      const claimed = await tx.notificationPreference.updateMany({ where: { userId: preference.userId,
        revision: preference.revision, nextSendAt: preference.nextSendAt,
        user: { lifecycleStatus: 'ACTIVE', emailVerified: true, projects: { some: monitored } } }, data: { nextSendAt } })
      if (claimed.count && preference.nextSendAt) await tx.notificationDigest.create({ data: {
        userId: preference.userId, revision: preference.revision, scheduledAt: preference.nextSendAt,
      } })
    })
  }
}

/** Settings hold the account before reading or saving preferences. Scheduler
 * writes follow that order, including the receipt's account foreign key. The
 * existing revision and due-slot predicates arbitrate competing schedulers. */
async function lockSummaryOwner(tx: Prisma.TransactionClient, userId: string) {
  const owners = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = ${userId} AND "lifecycleStatus" = 'ACTIVE' AND "emailVerified" = true FOR SHARE`
  return owners.length > 0
}
