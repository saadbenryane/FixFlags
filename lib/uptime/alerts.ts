import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy/brand'
import { uptimeEligible, uptimeProjectInclude } from './eligibility'
import { logger } from '@/lib/logger'
import { uptimeNotificationEmail } from '@/lib/email/uptime-notification'
import { notificationRecipientAllowed, projectEmailAcceptance } from '@/lib/email/delivery-events'
import { Prisma } from '@prisma/client'
import type { z } from 'zod'
import { NOTIFICATION_REQUEST_TIMEOUT_MS, assertNotificationReplayWindow, deliverNotificationBatch, prepareNotificationReplay,
  notificationEmailBody, notificationRetryAt, sendNotificationEmail } from '@/lib/email/notification-delivery'
import { notificationReceiptTag } from '@/lib/email/notification-receipt'
import { uptimeEmailSchema } from '@/lib/email/uptime-payload'
import { currentUptimeNotificationTargetSql } from './monitor-target'

function liveOutageDelivery(at: Date): Prisma.UptimeNotificationWhereInput {
  return { kind: 'DOWN', status: 'SENDING', leaseUntil: { gte: at } }
}

/** Receipt identity is also the provider idempotency key. Preferences are rechecked at delivery. */
export async function deliverUptimeNotifications(now = new Date(), limit = 20, scope?: string | { receiptId: string; ownerId: string }) {
  const onlyReceiptId = typeof scope === 'string' ? scope : scope?.receiptId
  const ownerId = typeof scope === 'object' ? scope.ownerId : undefined
  const startedAt = Date.now()
  // Preserve the caller's due-time reference while advancing across slow sends.
  const currentTime = () => new Date(now.getTime() + Math.max(0, Date.now() - startedAt))
  const selected = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT n.id FROM uptime_notifications n
    JOIN uptime_incidents i ON i.id = n."incidentId" JOIN uptime_monitors m ON m.id = i."monitorId"
    JOIN projects p ON p.id = m."projectId" JOIN users u ON u.id = p."userId"
    CROSS JOIN LATERAL (SELECT (${currentUptimeNotificationTargetSql}) AS is_current) target
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND u."emailVerified" = true
      ${onlyReceiptId ? Prisma.sql`AND n.id = ${onlyReceiptId}` : Prisma.empty}
      ${ownerId ? Prisma.sql`AND p."userId" = ${ownerId}` : Prisma.empty}
      AND n.status IN ('PENDING', 'FAILED', 'SENDING') AND n."nextAttemptAt" <= ${now}
      AND (n.attempts < n."maxAttempts" OR n.status = 'SENDING')
      AND (n."leaseUntil" IS NULL OR n."leaseUntil" < ${now})
      AND (n.kind <> 'RECOVERED' OR NOT EXISTS (SELECT 1 FROM uptime_notifications outage
        WHERE outage."incidentId" = i.id AND outage.kind = 'DOWN' AND outage.status = 'SENDING' AND outage."leaseUntil" >= ${now}))
    ORDER BY target.is_current DESC,
      ROW_NUMBER() OVER (PARTITION BY target.is_current, p.id ORDER BY n."nextAttemptAt", n.id), n."nextAttemptAt", n.id
    LIMIT ${limit}`
  if (!selected.length) return
  const receipts = await prisma.uptimeNotification.findMany({ where: { id: { in: selected.map(item => item.id) },
    status: { in: ['PENDING', 'FAILED', 'SENDING'] },
    incident: { monitor: { project: { userId: ownerId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE', emailVerified: true } } } },
  }, include: { incident: { include: { monitor: { include: { project: { include: uptimeProjectInclude } } } } } } })
  const byId = new Map(receipts.map(receipt => [receipt.id, receipt]))
  async function deliver(receipt: (typeof receipts)[number]) {
    if (receipt.attempts >= receipt.maxAttempts && receipt.status !== 'SENDING') return
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
          user: { id: project.user.id, email: project.user.email, emailVerified: true, lifecycleStatus: project.user.lifecycleStatus } } } } }
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
        return
      }
      if (receipt.attempts >= receipt.maxAttempts) {
        // A crashed final sender leaves uncertainty, not an indefinitely active delivery.
        await prisma.uptimeNotification.updateMany({ where: available, data: { status: 'FAILED',
          lastError: 'Delivery confirmation expired after the final attempt', leaseUntil: null } })
        return
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
            to: project.user.email, ...message, tags: [{ name: 'type', value: 'uptime' }, ...(receipt.attempts === 0
              ? [{ name: 'purpose', value: 'uptime' }, { name: 'notification_id', value: receipt.id }, notificationReceiptTag()] : [])] })
        }
        preparation = { payload: prepareNotificationReplay(payload, currentTime(), receipt.kind === 'RECOVERED'
          ? incident.recoveredAt ?? incident.confirmedAt : incident.confirmedAt) }
      } catch (error) { preparation = { error } }
      const claimAt = currentTime()
      const leaseUntil = new Date(claimAt.getTime() + 60_000)
      const deliveryPermission = receipt.kind === 'RECOVERED' ? { incident: { ...permission.incident,
        notifications: { none: liveOutageDelivery(claimAt) },
        monitor: { ...permission.incident.monitor, incidents: { none: laterIncident } } } } : permission
      // Freeze the exact body in the same conditional write as permission and
      // attempt ownership. No later payload write can bypass a changed recipient.
      const claimed = await prisma.uptimeNotification.updateMany({ where: {
        ...available, ...deliveryPermission, deliveryPayload: { equals: receipt.deliveryPayload ?? Prisma.DbNull },
      }, data: { status: 'SENDING', attempts: { increment: 1 }, leaseUntil,
        ...('payload' in preparation ? { deliveryPayload: preparation.payload } : {}) } })
      if (!claimed.count) return
      const ownedClaim = { id: receipt.id, status: 'SENDING', attempts: receipt.attempts + 1, leaseUntil }
      try {
        const recipientAllowed = 'payload' in preparation ? await notificationRecipientAllowed(preparation.payload.to) : true
        // Permission can change while the claim waits on the receipt row.
        if (!await prisma.uptimeNotification.findFirst({ where: { ...deliveryPermission, ...ownedClaim }, select: { id: true } })) {
          await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
            status: receipt.status, attempts: { decrement: 1 }, leaseUntil: receipt.leaseUntil,
            deliveryPayload: (receipt.deliveryPayload as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
          } })
          return
        }
        if ('error' in preparation) throw preparation.error
        if (!resend) throw new Error('Uptime email delivery is not configured')
        if (!recipientAllowed) {
          await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
            status: 'SKIPPED', attempts: { decrement: 1 }, leaseUntil: null,
          } })
          return
        }
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
  await deliverNotificationBatch(selected.flatMap(item => byId.get(item.id) ?? []), receipt => receipt.incident.monitor.projectId, deliver)
}
