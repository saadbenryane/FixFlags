import { prisma } from '@/lib/db'
import { deferEmailAcceptanceProjection, EMAIL_DELIVERY_RETENTION_MS, projectEmailAcceptance, reconcileEmailEvents } from './delivery-events'
import { sendNurtureEmail } from './send'
import { NURTURE_EMAILS, type NurtureEmailType } from './templates'
import { logger } from '@/lib/logger'
import { readUnprojectedEmailAcceptances } from './acceptance-sources'

const EMAIL_RETENTION_BATCH_SIZE = 500

/** Source receipts remain authoritative if the process stops between recording
 * provider acceptance and projecting delivery history. Only frozen recipients
 * and owners can be recovered; today's Site owner or account address cannot
 * rewrite historical mail. */
export async function recoverEmailDeliveryHistory(now = new Date(), limit = 50) {
  const since = new Date(now.getTime() - EMAIL_DELIVERY_RETENTION_MS)
  const sources = await readUnprojectedEmailAcceptances(prisma, since, limit, { dueAt: now })
  for (const source of sources) {
    const firstAttemptAt = source.firstAttemptAt ? new Date(source.firstAttemptAt) : source.acceptedAt
    if (Number.isFinite(firstAttemptAt.getTime()) && await projectEmailAcceptance({ ...source, firstAttemptAt })) continue
    if (!Number.isFinite(firstAttemptAt.getTime())) logger.error('Email delivery projection has an unreadable attempt date',
      { channel: source.channel, sourceId: source.sourceId })
    try { await deferEmailAcceptanceProjection(source, new Date(now.getTime() + 5 * 60_000)) }
    catch { logger.error('Email delivery projection retry could not be scheduled', { channel: source.channel, sourceId: source.sourceId }) }
  }
}

export async function maintainEmailDelivery(now = new Date(), limit = 50) {
  await recoverEmailDeliveryHistory(now, limit)
  const since = new Date(now.getTime() - EMAIL_DELIVERY_RETENTION_MS)
  // The selection lock lasts only for this query. Reconciliation reacquires
  // each receipt separately, so provider effects never hold the whole batch.
  const pending = await prisma.$queryRaw<Array<{ providerId: string }>>`
    WITH candidates AS (
      SELECT e."providerId", MIN(e."receivedAt") AS "firstReceivedAt"
      FROM email_provider_events e JOIN email_deliveries d ON d."providerId"=e."providerId"
      WHERE e."processedAt" IS NULL AND e."discardedAt" IS NULL AND e."expiresAt">${now} AND d."recipientHash"=ANY(e."recipientHashes")
        AND e."occurredAt">=d."firstAttemptAt"-interval '60 seconds'
        AND d."acceptedAt">=${since}
      GROUP BY e."providerId"
    )
    SELECT d."providerId" FROM candidates c JOIN email_deliveries d ON d."providerId"=c."providerId"
    ORDER BY c."firstReceivedAt" ASC, d."providerId" ASC
    LIMIT ${limit} FOR UPDATE OF d SKIP LOCKED`
  for (const event of pending) {
    try { await reconcileEmailEvents(event.providerId, now) }
    catch { logger.error('Email event reconciliation deferred', { providerId: event.providerId }) }
  }
  // Once correlation expires, keep only deduplication evidence until the
  // event is too old to be admitted again, even after provider replay.
  await prisma.$executeRaw`
    UPDATE email_provider_events
    SET "discardedAt" = ${now}, "providerId" = '', type = '', "recipientHashes" = ARRAY[]::text[],
      "expiresAt" = "occurredAt" + (${EMAIL_DELIVERY_RETENTION_MS} * interval '1 millisecond')
    WHERE id IN (
      SELECT id FROM email_provider_events
      WHERE "expiresAt" <= ${now} AND "processedAt" IS NULL AND "discardedAt" IS NULL
      ORDER BY "expiresAt" LIMIT ${EMAIL_RETENTION_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    )`
  await prisma.$executeRaw`
    DELETE FROM email_provider_events WHERE id IN (
      SELECT id FROM email_provider_events WHERE "expiresAt" <= ${now}
        AND ("processedAt" IS NOT NULL OR "discardedAt" IS NOT NULL)
      ORDER BY "expiresAt" LIMIT ${EMAIL_RETENTION_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    )`
  await prisma.$executeRaw`
    DELETE FROM email_deliveries WHERE "providerId" IN (
      SELECT "providerId" FROM email_deliveries WHERE "acceptedAt" < ${since}
      ORDER BY "acceptedAt" LIMIT ${EMAIL_RETENTION_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    )`
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
