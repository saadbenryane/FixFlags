import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { isReservedEmailRecipient } from '@/lib/email/recipient'
import { NOTIFICATION_REQUEST_TIMEOUT_MS, deliverNotificationBatch, notificationEmailBody, notificationRetryAt, prepareNotificationReplay,
  sendNotificationEmail, assertNotificationReplayWindow } from '@/lib/email/notification-delivery'
import { logger } from '@/lib/logger'
import { monitored, digestPayloadSchema } from './contracts'
import { scheduleSummaries } from './schedule'
import { buildSummaryPayload } from './summary'
import { notificationRecipientAllowed, projectEmailAcceptance } from '@/lib/email/delivery-events'

export { saveNotificationPreferences } from './store'

export async function deliverWebsiteSummaries(now = new Date(), limit = 20) {
  const start = Date.now(), currentTime = () => new Date(now.getTime() + Math.max(0, Date.now() - start))
  await prisma.notificationDigest.updateMany({ where: { status: 'SENDING', attempts: { gte: 5 },
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
  data: { status: 'FAILED', leaseUntil: null, lastError: 'Delivery was not confirmed after the final attempt' } })
  // A schedule admission failure cannot strand an already queued message.
  try { await scheduleSummaries(now, limit) }
  catch { logger.error('Summary scheduling failed; existing delivery receipts remain eligible') }
  // Admission can create a due receipt after the sweep began. Select against
  // the current clock so persistence latency does not defer it another minute.
  const selectionAt = currentTime()
  // Give current accounts one turn each before their backlog or obsolete rows.
  const selected = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH due AS (
      SELECT d.id, d."userId", d."nextAttemptAt",
        (u."lifecycleStatus" = 'ACTIVE' AND u."emailVerified" AND p.cadence <> 'OFF' AND p.revision = d.revision) AS current
      FROM notification_digests d
      JOIN notification_preferences p ON p."userId" = d."userId"
      JOIN users u ON u.id = d."userId"
      WHERE d.status IN ('PENDING', 'FAILED', 'SENDING') AND d.attempts < 5
        AND d."nextAttemptAt" <= ${selectionAt} AND (d."leaseUntil" IS NULL OR d."leaseUntil" < ${selectionAt})
    )
    SELECT id FROM due ORDER BY current DESC,
      ROW_NUMBER() OVER (PARTITION BY current, "userId" ORDER BY "nextAttemptAt", id), "nextAttemptAt", id
    LIMIT ${limit}`
  if (!selected.length) return
  const due = { nextAttemptAt: { lte: selectionAt }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: selectionAt } }] }
  const receipts = await prisma.notificationDigest.findMany({ where: { id: { in: selected.map(item => item.id) }, ...due,
    status: { in: ['PENDING', 'FAILED', 'SENDING'] }, attempts: { lt: 5 } },
  include: { user: { select: { email: true, emailVerified: true, lifecycleStatus: true } }, preference: true } })
  const byId = new Map(receipts.map(receipt => [receipt.id, receipt]))
  async function deliver(receipt: (typeof receipts)[number]) {
    const available = { id: receipt.id, status: receipt.status, attempts: receipt.attempts, ...due }
    try {
      if (receipt.preference.revision !== receipt.revision || receipt.preference.cadence === 'OFF' ||
          receipt.user.lifecycleStatus !== 'ACTIVE' || !receipt.user.emailVerified || isReservedEmailRecipient(receipt.user.email) ||
          !await notificationRecipientAllowed(receipt.user.email)) {
        await prisma.notificationDigest.updateMany({ where: available, data: { status: 'SKIPPED' } }); return
      }
      let payload: z.infer<typeof digestPayloadSchema>
      if (receipt.payload != null) {
        payload = digestPayloadSchema.parse(receipt.payload)
        if (payload.ownerId !== receipt.userId || payload.revision !== receipt.revision || payload.to !== receipt.user.email) {
          await prisma.notificationDigest.updateMany({ where: available, data: { status: 'SKIPPED' } }); return
        }
      } else {
        const fresh = await buildSummaryPayload(receipt, now, currentTime)
        if (!fresh) { await prisma.notificationDigest.updateMany({ where: available, data: { status: 'SKIPPED' } }); return }
        payload = fresh
      }
      payload = prepareNotificationReplay(payload, currentTime(), receipt.createdAt)
      const permission = { user: { lifecycleStatus: 'ACTIVE' as const, emailVerified: true, email: payload.to,
        AND: payload.sites.map(site => ({ projects: { some: { ...monitored, ...site } } })) },
      preference: { revision: receipt.revision, cadence: { not: 'OFF' as const } } }
      const leaseUntil = new Date(currentTime().getTime() + 60_000)
      const claimed = await prisma.notificationDigest.updateMany({ where: { ...available, ...permission,
        payload: { equals: receipt.payload ?? Prisma.DbNull } },
      data: { status: 'SENDING', attempts: { increment: 1 }, leaseUntil, payload } })
      if (!claimed.count) {
        await prisma.notificationDigest.updateMany({ where: available, data: { status: 'SKIPPED' } }); return
      }
      const owned = { id: receipt.id, status: 'SENDING' as const, attempts: receipt.attempts + 1, leaseUntil }
      try {
        // Authorization can change while the claim waits or its result returns.
        const recipientAllowed = await notificationRecipientAllowed(payload.to)
        if (!recipientAllowed || !await prisma.notificationDigest.findFirst({ where: { ...owned, ...permission }, select: { id: true } })) {
          await prisma.notificationDigest.updateMany({ where: owned, data: {
            status: 'SKIPPED', attempts: { decrement: 1 }, leaseUntil: null,
            payload: (receipt.payload as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
          } })
          return
        }
        if (!resend) throw new Error('Email delivery is not configured')
        if (leaseUntil.getTime() - currentTime().getTime() <= NOTIFICATION_REQUEST_TIMEOUT_MS)
          throw new Error('Summary claim has insufficient time for delivery')
        assertNotificationReplayWindow(payload.firstAttemptAt, currentTime())
        const providerId = await sendNotificationEmail(resend, notificationEmailBody(payload), `fixflags-summary-${receipt.id}`)
        const recorded = await prisma.notificationDigest.updateMany({ where: owned,
          data: { status: 'SENT', sentAt: currentTime(), providerId, leaseUntil: null, lastError: null } })
        if (recorded.count) await projectEmailAcceptance({ providerId, userId: receipt.userId, email: payload.to,
          channel: 'summary', sourceId: receipt.id, acceptedAt: currentTime(), firstAttemptAt: new Date(payload.firstAttemptAt!) })
      } catch (error) {
        await prisma.notificationDigest.updateMany({ where: owned, data: { status: 'FAILED', leaseUntil: null,
          nextAttemptAt: notificationRetryAt(receipt.attempts + 1, currentTime()),
          lastError: error instanceof Error ? error.message.slice(0, 500) : 'Email delivery unavailable' } })
      }
    } catch (error) {
      logger.error('Website summary processing failed', { receiptId: receipt.id, error: error instanceof Error ? error.message : 'Unavailable' })
      try {
        await prisma.notificationDigest.updateMany({ where: available, data: { status: 'FAILED', attempts: { increment: 1 },
          nextAttemptAt: notificationRetryAt(receipt.attempts + 1, currentTime()), lastError: 'Summary preparation unavailable' } })
      } catch { logger.error('Summary deferral could not be saved; retained receipt remains recoverable', { receiptId: receipt.id }) }
    }
  }
  await deliverNotificationBatch(selected.flatMap(item => byId.get(item.id) ?? []), receipt => receipt.userId, deliver)
}
