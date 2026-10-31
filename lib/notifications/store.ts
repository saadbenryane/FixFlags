import { prisma } from '@/lib/db'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { DEFAULT_NOTIFICATION_PREFERENCES, nextSummaryAt, notificationPreferencesPatchSchema, notificationPreferencesSchema, readNotificationPreferences, summaryCadence } from './preferences'
import { monitored } from './contracts'

export async function saveNotificationPreferences(userId: string, input: unknown, now = new Date()) {
  const patch = notificationPreferencesPatchSchema.parse(input)
  return prisma.$transaction(async tx => {
    const owners = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id=${userId} AND "lifecycleStatus"='ACTIVE' FOR UPDATE`
    if (!owners.length) throw new SiteRunRefusal('Account unavailable.', 403)
    const existing = await tx.notificationPreference.findUnique({ where: { userId } })
    const previous = existing ? readNotificationPreferences(existing) : DEFAULT_NOTIFICATION_PREFERENCES
    const changes = notificationPreferencesSchema.parse({ ...previous, ...patch })
    const scheduleChanged = !existing || (['cadence', 'hour', 'weekday', 'timeZone'] as const).some(key => changes[key] !== previous[key])
    const sites = await tx.project.findMany({ where: { userId, ...monitored }, select: { watchInterval: true, watchEveryMinutes: true } })
    const resolvedCadence = summaryCadence(changes, sites)
    const nextSendAt = scheduleChanged ? nextSummaryAt(changes, resolvedCadence, now) : existing.nextSendAt
    const saved = await tx.notificationPreference.upsert({ where: { userId },
      create: { userId, ...changes, nextSendAt, resolvedCadence }, update: { ...changes, nextSendAt, resolvedCadence, revision: { increment: scheduleChanged ? 1 : 0 } } })
    return { ...readNotificationPreferences(saved), nextSendAt: saved.nextSendAt?.toISOString() ?? null }
  })
}
