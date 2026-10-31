import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { projectEmailAcceptance, reconcileEmailEvents } from './delivery-events'
import { sendNurtureEmail } from './send'
import { NURTURE_EMAILS, type NurtureEmailType } from './templates'
import { logger } from '@/lib/logger'

/** Source receipts remain authoritative if the process stops between recording
 * provider acceptance and projecting delivery history. Only frozen recipients
 * can be recovered; today's account address cannot rewrite historical mail. */
export async function recoverEmailDeliveryHistory(now = new Date(), limit = 50) {
  const since = new Date(now.getTime() - 90 * 86400_000)
  const sources = await prisma.$queryRaw<Array<{ providerId: string; userId: string; email: string;
    channel: 'summary' | 'watch' | 'uptime' | 'onboarding'; sourceId: string; acceptedAt: Date; firstAttemptAt: string | null }>>(Prisma.sql`
    SELECT source.* FROM (
      SELECT "providerId", "userId", payload->>'to' AS email, 'summary' AS channel, id AS "sourceId", "sentAt" AS "acceptedAt", payload->>'firstAttemptAt' AS "firstAttemptAt"
        FROM notification_digests WHERE status='SENT' AND "deliveryProjectedAt" IS NULL AND "sentAt">=${since} AND "providerId" IS NOT NULL AND payload->>'to' IS NOT NULL
      UNION ALL
      SELECT "watchNotificationProviderId", "userId", "watchNotificationPayload"->>'to', 'watch', id, "watchNotifiedAt", "watchNotificationPayload"->>'firstAttemptAt'
        FROM audits WHERE "watchNotificationStatus"='SENT' AND "watchDeliveryProjectedAt" IS NULL AND "watchNotifiedAt">=${since} AND "watchNotificationProviderId" IS NOT NULL
          AND "userId" IS NOT NULL AND "watchNotificationPayload"->>'to' IS NOT NULL
      UNION ALL
      SELECT n."providerId", p."userId", n."deliveryPayload"->>'to', 'uptime', n.id, n."sentAt", n."deliveryPayload"->>'firstAttemptAt'
        FROM uptime_notifications n JOIN uptime_incidents i ON i.id=n."incidentId"
          JOIN uptime_monitors m ON m.id=i."monitorId" JOIN projects p ON p.id=m."projectId"
        WHERE n.status='SENT' AND n."deliveryProjectedAt" IS NULL AND n."sentAt">=${since} AND n."providerId" IS NOT NULL AND n."deliveryPayload"->>'to' IS NOT NULL
          AND n."deliveryPayload"->>'ownerId'=p."userId"
      UNION ALL
      SELECT "providerId", "userId", payload->>'to', 'onboarding', id, "sentAt", payload->>'firstAttemptAt'
        FROM email_logs WHERE status='SENT' AND "deliveryProjectedAt" IS NULL AND "sentAt">=${since} AND "providerId" IS NOT NULL AND payload->>'to' IS NOT NULL
    ) source ORDER BY source."acceptedAt" ASC LIMIT ${limit}`)
  for (const source of sources) {
    const firstAttemptAt = source.firstAttemptAt ? new Date(source.firstAttemptAt) : source.acceptedAt
    if (!Number.isFinite(firstAttemptAt.getTime())) continue
    await projectEmailAcceptance({ ...source, firstAttemptAt })
  }
}

export async function maintainEmailDelivery(now = new Date(), limit = 50) {
  await recoverEmailDeliveryHistory(now, limit)
  const pending = await prisma.$queryRaw<Array<{ providerId: string }>>`
    SELECT e."providerId" FROM email_provider_events e JOIN email_deliveries d ON d."providerId"=e."providerId"
    WHERE e."processedAt" IS NULL AND e."expiresAt">${now} AND d."recipientHash"=ANY(e."recipientHashes")
      AND e."occurredAt">=d."firstAttemptAt"-interval '60 seconds'
    GROUP BY e."providerId" ORDER BY MIN(e."receivedAt") ASC LIMIT ${limit}`
  for (const event of pending) {
    try { await reconcileEmailEvents(event.providerId, now) }
    catch { logger.error('Email event reconciliation deferred', { providerId: event.providerId }) }
  }
  await prisma.emailProviderEvent.deleteMany({ where: { expiresAt: { lte: now } } })
  await prisma.emailDelivery.deleteMany({ where: { acceptedAt: { lt: new Date(now.getTime() - 90 * 86400_000) } } })
}

export async function retryPendingNurtureEmails(now = new Date(), limit = 20) {
  await prisma.emailLog.updateMany({ where: { status: 'PENDING', attempts: { gte: 5 },
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
  data: { status: 'FAILED', leaseUntil: null, errorMsg: 'Delivery was not confirmed after the final attempt' } })
  const logs = await prisma.emailLog.findMany({ where: { status: { in: ['PENDING', 'FAILED'] }, attempts: { lt: 5 },
    user: { lifecycleStatus: 'ACTIVE', emailVerified: true },
    AND: [{ OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      { OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] },
      { OR: [{ emailType: 'welcome' }, { user: { notificationPreference: { productTips: true } } }] }],
  }, orderBy: [{ nextAttemptAt: 'asc' }, { id: 'asc' }], take: limit })
  for (const log of logs) {
    if (!Object.hasOwn(NURTURE_EMAILS, log.emailType)) continue
    try {
      const result = await sendNurtureEmail(log.userId, log.emailType as NurtureEmailType)
      if (['recipient_suppressed', 'reserved_recipient_domain', 'recipient_changed'].includes(result.reason ?? ''))
        await prisma.emailLog.updateMany({ where: { id: log.id, attempts: log.attempts, status: log.status },
          data: { status: 'FAILED', attempts: 5, errorMsg: result.reason, leaseUntil: null } })
    } catch { logger.error('Getting-started email retry deferred', { sourceId: log.id }) }
  }
}
