import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy/brand'
import { uptimeEligible, uptimeProjectInclude } from './eligibility'
import { logger } from '@/lib/logger'
import { uptimeNotificationEmail } from '@/lib/email/uptime-notification'
import { notificationRecipientAllowed, projectEmailAcceptance } from '@/lib/email/delivery-events'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { NOTIFICATION_REQUEST_TIMEOUT_MS, assertNotificationReplayWindow, prepareNotificationReplay, notificationEmailBody, notificationEmailSnapshotSchema, notificationRetryAt, sendNotificationEmail } from '@/lib/email/notification-delivery'

const uptimeEmailSchema = notificationEmailSnapshotSchema.extend({
  ownerId: z.string().min(1), projectId: z.string().min(1), incidentId: z.string().min(1),
  kind: z.enum(['DOWN', 'RECOVERED']), targetVersion: z.number().int().positive(),
}).strict()

/** Receipt identity is also the provider idempotency key. Preferences are rechecked at delivery. */
export async function deliverUptimeNotifications(now = new Date(), limit = 20, onlyReceiptId?: string) {
  const startedAt = Date.now()
  // Preserve the caller's due-time reference while advancing across slow sends.
  const currentTime = () => new Date(now.getTime() + Math.max(0, Date.now() - startedAt))
  const receipts = await prisma.uptimeNotification.findMany({ where: {
    incident: { monitor: { project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } } },
    ...(onlyReceiptId ? { id: onlyReceiptId } : {}),
    status: { in: ['PENDING', 'FAILED', 'SENDING'] }, nextAttemptAt: { lte: now },
    AND: [{ OR: [{ attempts: { lt: prisma.uptimeNotification.fields.maxAttempts } }, { status: 'SENDING' }] }],
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
  }, include: { incident: { include: { monitor: { include: { project: { include: uptimeProjectInclude } } } } } },
  orderBy: { nextAttemptAt: 'asc' }, take: limit })
  for (const receipt of receipts) {
    const attemptAt = currentTime()
    const { incident } = receipt, { monitor } = incident, { project } = monitor
    const available = { id: receipt.id, attempts: receipt.attempts, maxAttempts: receipt.maxAttempts,
      status: receipt.status, kind: receipt.kind, incidentId: receipt.incidentId,
      nextAttemptAt: { lte: attemptAt }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: attemptAt } }] }
    const permission = { incident: { version: incident.version, supersededAt: incident.supersededAt, targetUrl: incident.targetUrl,
      recoveredAt: incident.recoveredAt,
      monitor: { id: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl, enabled: monitor.enabled,
        project: { id: project.id, userId: project.userId, url: project.url, deletedAt: project.deletedAt,
          watchPausedAt: project.watchPausedAt,
          watchInterval: project.watchInterval ? { not: null } : null,
          notificationLevel: project.notificationLevel, notifyOnRecovery: project.notifyOnRecovery,
          user: { id: project.user.id, email: project.user.email, lifecycleStatus: project.user.lifecycleStatus } } } } }
    const target = normalizeAuditUrl(project.url)
    try {
      // Delivery describes the still-current event. Retain older incidents and
      // payloads as history without sending a recovered outage or stale recovery.
      const laterIncident = { id: { not: incident.id }, monitorId: monitor.id, version: incident.version, targetUrl: incident.targetUrl,
        confirmedAt: { gte: incident.recoveredAt ?? incident.confirmedAt } }
      const recoverySuperseded = receipt.kind === 'RECOVERED' && Boolean(await prisma.uptimeIncident.findFirst({
        where: laterIncident, select: { id: true },
      }))
      if (!['DOWN', 'RECOVERED'].includes(receipt.kind) || !target.ok || target.url !== monitor.targetUrl ||
        incident.targetUrl !== monitor.targetUrl || !monitor.enabled || !uptimeEligible(project) || project.notificationLevel === 'OFF' ||
        receipt.kind === 'DOWN' && incident.recoveredAt !== null || recoverySuperseded ||
        (receipt.kind === 'RECOVERED' && (!project.notifyOnRecovery || !incident.recoveredAt)) ||
        incident.supersededAt || incident.version !== monitor.version || !await notificationRecipientAllowed(project.user.email)) {
        await prisma.uptimeNotification.updateMany({ where: { ...available, ...permission }, data: { status: 'SKIPPED', leaseUntil: null } })
        continue
      }
      if (receipt.attempts >= receipt.maxAttempts) {
        // A crashed final sender leaves uncertainty, not an indefinitely active delivery.
        await prisma.uptimeNotification.updateMany({ where: available, data: { status: 'FAILED',
          lastError: 'Delivery confirmation expired after the final attempt', leaseUntil: null } })
        continue
      }
      let preparation: { payload: z.infer<typeof uptimeEmailSchema> } | { error: unknown }
      try {
        if (!resend) throw new Error('Uptime email delivery is not configured')
        const scope = { ownerId: project.userId, projectId: project.id, incidentId: incident.id,
          kind: receipt.kind, targetVersion: incident.version }
        let payload: z.infer<typeof uptimeEmailSchema>
        if (receipt.deliveryPayload != null) {
          payload = uptimeEmailSchema.parse(receipt.deliveryPayload)
          if (payload.to !== project.user.email || Object.entries(scope).some(([key, value]) => payload[key as keyof typeof scope] !== value))
            throw new Error('Recorded notification no longer matches its recipient or incident')
        } else {
          const message = uptimeNotificationEmail({ projectId: project.id, url: incident.targetUrl,
            kind: receipt.kind as 'DOWN' | 'RECOVERED', at: receipt.kind === 'DOWN' ? incident.confirmedAt : incident.recoveredAt! })
          payload = uptimeEmailSchema.parse({ version: 1, ...scope,
            firstAttemptAt: receipt.attempts === 0 ? currentTime().toISOString() : undefined,
            from: process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`,
            to: project.user.email, ...message, tags: [{ name: 'type', value: 'uptime' }] })
        }
        preparation = { payload: prepareNotificationReplay(payload, currentTime(), receipt.kind === 'RECOVERED'
          ? incident.recoveredAt ?? incident.confirmedAt : incident.confirmedAt) }
      } catch (error) { preparation = { error } }
      const leaseUntil = new Date(currentTime().getTime() + 60_000)
      // Freeze the exact body in the same conditional write as permission and
      // attempt ownership. No later payload write can bypass a changed recipient.
      const claimed = await prisma.uptimeNotification.updateMany({ where: {
        ...available, ...permission, deliveryPayload: { equals: receipt.deliveryPayload ?? Prisma.DbNull },
        ...(receipt.kind === 'RECOVERED' ? { incident: { ...permission.incident,
          monitor: { ...permission.incident.monitor, incidents: { none: laterIncident } } } } : {}),
      }, data: { status: 'SENDING', attempts: { increment: 1 }, leaseUntil,
        ...('payload' in preparation ? { deliveryPayload: preparation.payload } : {}) } })
      if (!claimed.count) continue
      const ownedClaim = { id: receipt.id, status: 'SENDING', attempts: receipt.attempts + 1, leaseUntil }
      try {
        if ('error' in preparation) throw preparation.error
        if (!resend) throw new Error('Uptime email delivery is not configured')
        // A slow database response must not start a request that can outlive its claim.
        if (leaseUntil.getTime() - currentTime().getTime() <= NOTIFICATION_REQUEST_TIMEOUT_MS)
          throw new Error('Notification claim has insufficient time for provider delivery')
        assertNotificationReplayWindow(preparation.payload.firstAttemptAt, currentTime())
        const providerId = await sendNotificationEmail(resend, notificationEmailBody(preparation.payload), `uptime-${receipt.id}`)
        const recorded = await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
          status: 'SENT', sentAt: currentTime(), providerId, lastError: null, leaseUntil: null,
        } })
        if (recorded.count) await projectEmailAcceptance({ providerId, userId: project.userId, email: preparation.payload.to,
          channel: 'uptime', sourceId: receipt.id, acceptedAt: currentTime(), firstAttemptAt: new Date(preparation.payload.firstAttemptAt!) })
      } catch (error) {
        logger.error('Uptime notification delivery failed', { receiptId: receipt.id, error: error instanceof Error ? error.message : 'delivery unavailable' })
        await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
          status: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Delivery unavailable', leaseUntil: null,
          nextAttemptAt: notificationRetryAt(receipt.attempts + 1, currentTime()),
        } })
      }
    } catch (error) {
      logger.error('Uptime notification processing interrupted; other receipts remain eligible', {
        receiptId: receipt.id, error: error instanceof Error ? error.message : 'processing unavailable',
      })
      try {
        // Rotate only the selected, still-unclaimed receipt. A claimed attempt
        // retains its exact lease, payload and provider key for later recovery.
        await prisma.uptimeNotification.updateMany({ where: { ...available, ...permission }, data: {
          nextAttemptAt: new Date(currentTime().getTime() + 30_000),
          lastError: 'Notification processing interrupted; delivery will be retried',
        } })
      } catch (retryError) {
        logger.error('Uptime notification deferral failed; retained receipt will be retried', {
          receiptId: receipt.id, error: retryError instanceof Error ? retryError.message : 'persistence unavailable',
        })
      }
    }
  }
}
