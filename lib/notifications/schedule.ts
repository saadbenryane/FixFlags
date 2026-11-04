import { prisma } from '@/lib/db'
import type { NotificationPreference, Prisma } from '@prisma/client'
import { nextSummaryAt, readNotificationPreferences, summaryCadence } from './preferences'
import { monitored, dailyMonitoring } from './contracts'
import { logger } from '@/lib/logger'

// Operational writes already own updatedAt. Untouched due accounts precede
// failed scheduling attempts without changing a delivery slot or revision.
const schedulingOrder: Prisma.NotificationPreferenceOrderByWithRelationInput[] = [{ updatedAt: 'asc' }, { userId: 'asc' }]

async function retainFailedSchedule(preference: Pick<NotificationPreference, 'userId' | 'revision' | 'updatedAt'>, now: Date, error: unknown) {
  logger.error('Summary scheduling failed for one account; independent accounts continue', {
    userId: preference.userId, error: error instanceof Error ? error.message : 'Scheduling unavailable',
  })
  try {
    await prisma.notificationPreference.updateMany({ where: { userId: preference.userId, revision: preference.revision,
      updatedAt: preference.updatedAt }, data: { updatedAt: now } })
  } catch {
    logger.error('Summary scheduling rotation could not be saved; original intent remains due', { userId: preference.userId })
  }
}

/** Existing and newly created accounts acquire the same default. No historical
 * backlog is mailed: the first summary waits for the next local delivery slot. */
export async function scheduleSummaries(now: Date, limit: number) {
  const unavailable = new Set<string>()
  const owners = await prisma.user.findMany({ where: { lifecycleStatus: 'ACTIVE', emailVerified: true,
    notificationPreference: null, projects: { some: monitored } }, select: { id: true }, orderBy: { id: 'asc' }, take: limit })
  for (const owner of owners) {
    try {
      await prisma.$transaction(async tx => {
        if (!await lockSummaryOwner(tx, owner.id)) return
        await tx.notificationPreference.createMany({ data: [{ userId: owner.id }], skipDuplicates: true })
      })
    } catch (error) {
      unavailable.add(owner.id)
      logger.error('Summary default initialization failed for one account; independent accounts continue', {
        userId: owner.id, error: error instanceof Error ? error.message : 'Initialization unavailable',
      })
    }
  }
  // Reconcile changed monitoring before the next summary becomes due. This is a
  // change query, so unchanged accounts cannot starve later accounts in the batch.
  const changed = await prisma.notificationPreference.findMany({ where: { cadence: 'FOLLOW_MONITORING',
    ...(unavailable.size ? { userId: { notIn: [...unavailable] } } : {}),
    user: { lifecycleStatus: 'ACTIVE', emailVerified: true, projects: { some: monitored } },
    OR: [{ resolvedCadence: null }, { resolvedCadence: 'DAILY', user: { projects: { none: dailyMonitoring } } },
      { resolvedCadence: 'WEEKLY', user: { projects: { some: dailyMonitoring } } }],
  }, select: { userId: true, revision: true, updatedAt: true, hour: true, weekday: true, timeZone: true, cadence: true,
    user: { select: { projects: { where: monitored, select: { watchInterval: true, watchEveryMinutes: true } } } } },
  orderBy: schedulingOrder, take: limit })
  for (const preference of changed) {
    try {
      const values = readNotificationPreferences(preference), resolvedCadence = summaryCadence(values, preference.user.projects)
      await prisma.$transaction(async tx => {
        if (!await lockSummaryOwner(tx, preference.userId)) return
        await tx.notificationPreference.updateMany({ where: { userId: preference.userId, revision: preference.revision },
          data: { resolvedCadence, nextSendAt: nextSummaryAt(values, resolvedCadence, now), revision: { increment: 1 } } })
      })
    } catch (error) {
      unavailable.add(preference.userId)
      await retainFailedSchedule(preference, now, error)
    }
  }
  const preferences = await prisma.notificationPreference.findMany({ where: {
    ...(unavailable.size ? { userId: { notIn: [...unavailable] } } : {}),
    cadence: { not: 'OFF' }, user: { lifecycleStatus: 'ACTIVE', emailVerified: true, projects: { some: monitored } },
    OR: [{ nextSendAt: null }, { nextSendAt: { lte: now } }],
  }, include: { user: { select: { projects: { where: monitored, select: { watchInterval: true, watchEveryMinutes: true } } } } },
  orderBy: schedulingOrder, take: limit })
  for (const preference of preferences) {
    try {
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
    } catch (error) { await retainFailedSchedule(preference, now, error) }
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

