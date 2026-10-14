import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy/brand'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { uptimeEligible } from './eligibility'
import { logger } from '@/lib/logger'
import { emailLayout, escapeEmailHtml } from '@/lib/email/layout'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { notificationEmailBody, notificationEmailSnapshotSchema, sendNotificationEmail } from '@/lib/email/notification-delivery'
import { getAppUrl } from '@/lib/get-app-url'

const uptimeEmailSchema = notificationEmailSnapshotSchema.extend({
  ownerId: z.string().min(1), projectId: z.string().min(1), incidentId: z.string().min(1),
  kind: z.enum(['DOWN', 'RECOVERED']), targetVersion: z.number().int().positive(),
}).strict()

/** Receipt identity is also the provider idempotency key. Preferences are rechecked at delivery. */
export async function deliverUptimeNotifications(now = new Date(), limit = 20, onlyReceiptId?: string) {
  const receipts = await prisma.uptimeNotification.findMany({ where: {
    incident: { monitor: { project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } } },
    ...(onlyReceiptId ? { id: onlyReceiptId } : {}),
    status: { in: ['PENDING', 'FAILED', 'SENDING'] }, nextAttemptAt: { lte: now },
    AND: [{ OR: [{ attempts: { lt: prisma.uptimeNotification.fields.maxAttempts } }, { status: 'SENDING' }] }],
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
  }, include: { incident: { include: { monitor: { include: { project: { include: { user: true } } } } } } },
  orderBy: { nextAttemptAt: 'asc' }, take: limit })
  for (const receipt of receipts) {
    const { incident } = receipt, { monitor } = incident, { project } = monitor
    const available = { id: receipt.id, attempts: receipt.attempts, maxAttempts: receipt.maxAttempts,
      status: receipt.status, kind: receipt.kind, incidentId: receipt.incidentId,
      nextAttemptAt: { lte: now }, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] }
    const permission = { incident: { version: incident.version, supersededAt: incident.supersededAt, targetUrl: incident.targetUrl,
      recoveredAt: incident.recoveredAt,
      monitor: { id: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl, enabled: monitor.enabled,
        project: { id: project.id, userId: project.userId, url: project.url, deletedAt: project.deletedAt,
          watchInterval: project.watchInterval, watchNextRunAt: project.watchNextRunAt,
          notificationLevel: project.notificationLevel, notifyOnRecovery: project.notifyOnRecovery,
          user: { id: project.user.id, email: project.user.email, lifecycleStatus: project.user.lifecycleStatus,
            role: project.user.role, plan: project.user.plan, subscriptionStatus: project.user.subscriptionStatus } } } } }
    const target = normalizeAuditUrl(project.url)
    if (!['DOWN', 'RECOVERED'].includes(receipt.kind) || !target.ok || target.url !== monitor.targetUrl ||
      incident.targetUrl !== monitor.targetUrl || !monitor.enabled || !uptimeEligible(project) || project.notificationLevel === 'OFF' ||
      (receipt.kind === 'RECOVERED' && (!project.notifyOnRecovery || !incident.recoveredAt)) ||
      incident.supersededAt || incident.version !== monitor.version) {
      await prisma.uptimeNotification.updateMany({ where: { ...available, ...permission }, data: { status: 'SKIPPED', leaseUntil: null } })
      continue
    }
    if (receipt.attempts >= receipt.maxAttempts) {
      // A crashed final sender leaves uncertainty, not an indefinitely active delivery.
      await prisma.uptimeNotification.updateMany({ where: available, data: { status: 'FAILED',
        lastError: 'Delivery confirmation expired after the final attempt', leaseUntil: null } })
      continue
    }
    const leaseUntil = new Date(now.getTime() + 60_000)
    // Compare current permission at the physical claim, after the batch read.
    const claimed = await prisma.uptimeNotification.updateMany({ where: {
      ...available, ...permission,
    }, data: { status: 'SENDING', attempts: { increment: 1 }, leaseUntil } })
    if (!claimed.count) continue
    const ownedClaim = { id: receipt.id, status: 'SENDING', attempts: receipt.attempts + 1, leaseUntil }
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
        const subject = receipt.kind === 'DOWN' ? UPTIME_COPY.email.downSubject : UPTIME_COPY.email.recoverySubject
        const href = `${getAppUrl()}/sites/${project.id}?view=timeline`
        const body = receipt.kind === 'DOWN' ? UPTIME_COPY.email.downBody(incident.targetUrl, incident.confirmedAt.toISOString(), href)
          : UPTIME_COPY.email.recoveryBody(incident.targetUrl, incident.recoveredAt!.toISOString(), href)
        payload = uptimeEmailSchema.parse({ version: 1, ...scope,
          from: process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`,
          to: project.user.email, subject, text: body, tags: [],
          html: emailLayout(body.split('\n\n').map(paragraph => `<p>${escapeEmailHtml(paragraph)}</p>`).join('')) })
        const saved = await prisma.uptimeNotification.updateMany({ where: { ...ownedClaim, deliveryPayload: { equals: Prisma.DbNull } },
          data: { deliveryPayload: payload } })
        if (saved.count !== 1) continue
      }
      const providerId = await sendNotificationEmail(resend, notificationEmailBody(payload), `uptime-${receipt.id}`)
      await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
        status: 'SENT', sentAt: new Date(), providerId, lastError: null, leaseUntil: null,
      } })
    } catch (error) {
      logger.error('Uptime notification delivery failed', { receiptId: receipt.id, error: error instanceof Error ? error.message : 'delivery unavailable' })
      await prisma.uptimeNotification.updateMany({ where: ownedClaim, data: {
        status: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Delivery unavailable', leaseUntil: null,
        nextAttemptAt: new Date(now.getTime() + Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** receipt.attempts)),
      } })
    }
  }
}
