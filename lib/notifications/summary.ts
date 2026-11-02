import type { NotificationDigest, NotificationPreference } from '@prisma/client'
import { prisma } from '@/lib/db'
import { FROM_EMAIL } from '@/lib/email/from'
import { websiteSummaryEmail } from '@/lib/email/website-summary'
import { loadSiteNotificationSummaries } from '@/lib/sites/application/list-sites'
import { readNotificationPreferences, summaryCadence } from './preferences'
import { digestPayloadSchema, monitored } from './contracts'

type SummaryReceipt = Pick<NotificationDigest, 'id' | 'userId' | 'revision' | 'scheduledAt'> & {
  user: { email: string }; preference: NotificationPreference;
}

/** Project only the same current findings and coverage that the owner sees on
 * the website board. The sender separately owns permission and delivery. */
export async function buildSummaryPayload(receipt: SummaryReceipt, now: Date, currentTime: () => Date) {
  const projects = await prisma.project.findMany({ where: { userId: receipt.userId, ...monitored },
    orderBy: { id: 'asc' }, select: { id: true, url: true, watchInterval: true, watchEveryMinutes: true,
      notificationLevel: true, notifyOnRecovery: true,
    } })
  if (!projects.length) return null
  const totalSites = projects.length
  const byId = new Map(projects.map(site => [site.id, site]))
  const summaries = (await loadSiteNotificationSummaries(receipt.userId, now)).filter(site => byId.has(site.id)).slice(0, 20)
  if (!summaries.length) throw new Error('Current website results are unavailable')
  const previous = await prisma.notificationDigest.findFirst({ where: { userId: receipt.userId, status: 'SENT',
    scheduledAt: { lt: receipt.scheduledAt } }, orderBy: { scheduledAt: 'desc' }, select: { scheduledAt: true } })
  const preferences = readNotificationPreferences(receipt.preference)
  const cadence = summaryCadence(preferences, projects)
  if (!cadence) return null
  const message = websiteSummaryEmail({ cadence, totalSites, timeZone: preferences.timeZone, asOf: now,
    sites: summaries.map(site => {
      const project = byId.get(site.id)!, facts = site.presentation
      const checkedAt = facts.freshness.checkedAt ? new Date(facts.freshness.checkedAt) : null
      return { id: site.id, url: project.url, checkedAt,
        urgentOnly: project.notificationLevel === 'CRITICAL_ONLY',
        problems: project.notificationLevel === 'CRITICAL_ONLY' ? site.notification.criticalCount : facts.flags.count,
        incomplete: site.notification.incomplete, stale: facts.freshness.stale, failed: ['failed', 'interrupted'].includes(facts.run.state),
        unchanged: !!(checkedAt && previous && checkedAt <= previous.scheduledAt), offline: site.notification.offline }
    }) })
  return digestPayloadSchema.parse({ version: 1, ownerId: receipt.userId, revision: receipt.revision,
    from: FROM_EMAIL, to: receipt.user.email, ...message, tags: [{ name: 'type', value: 'website-summary' }],
    sites: summaries.map(summary => byId.get(summary.id)!).map(site => ({ id: site.id, url: site.url, watchInterval: site.watchInterval,
      watchEveryMinutes: site.watchEveryMinutes, notificationLevel: site.notificationLevel, notifyOnRecovery: site.notifyOnRecovery })),
    firstAttemptAt: currentTime().toISOString() })
}
