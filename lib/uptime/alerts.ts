import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy/brand'
import { UPTIME_COPY } from '@/lib/marketing/copy/uptime'
import { uptimeEligible } from './service'
import { logger } from '@/lib/logger'
import { emailLayout, escapeEmailHtml } from '@/lib/email/layout'

/** Receipt identity is also the provider idempotency key. Preferences are rechecked at delivery. */
export async function deliverUptimeNotifications(now = new Date(), limit = 20) {
  const receipts = await prisma.uptimeNotification.findMany({ where: {
    status: { in: ['PENDING', 'FAILED', 'SENDING'] }, attempts: { lt: 8 }, nextAttemptAt: { lte: now },
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
  }, orderBy: { nextAttemptAt: 'asc' }, take: limit })
  for (const receipt of receipts) {
    const leaseUntil = new Date(now.getTime() + 60_000)
    const claimed = await prisma.uptimeNotification.updateMany({ where: {
      id: receipt.id, attempts: receipt.attempts, status: receipt.status,
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
    }, data: { status: 'SENDING', attempts: { increment: 1 }, leaseUntil } })
    if (!claimed.count) continue
    try {
      const current = await prisma.uptimeNotification.findUniqueOrThrow({ where: { id: receipt.id },
        include: { incident: { include: { monitor: { include: { project: { include: { user: true } } } } } } } })
      const { incident } = current, { monitor } = incident, { project } = monitor
      const target = normalizeAuditUrl(project.url)
      if (!target.ok || target.url !== monitor.targetUrl || !uptimeEligible(project) || project.notificationLevel === 'OFF' ||
        (receipt.kind === 'RECOVERED' && !project.notifyOnRecovery) || incident.supersededAt || incident.version !== monitor.version) {
        await prisma.uptimeNotification.updateMany({ where: { id: receipt.id, leaseUntil }, data: { status: 'SKIPPED', leaseUntil: null } })
        continue
      }
      if (!resend) throw new Error('Uptime email delivery is not configured')
      const subject = receipt.kind === 'DOWN' ? UPTIME_COPY.email.downSubject : UPTIME_COPY.email.recoverySubject
      const href = `${process.env.NEXT_PUBLIC_APP_URL}/sites/${project.id}?view=timeline`
      const body = receipt.kind === 'DOWN' ? UPTIME_COPY.email.downBody(incident.targetUrl, incident.confirmedAt.toISOString(), href)
        : UPTIME_COPY.email.recoveryBody(incident.targetUrl, incident.recoveredAt!.toISOString(), href)
      const { data, error } = await resend.emails.send({ from: process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`,
        to: project.user.email, subject, text: body,
        html: emailLayout(body.split('\n\n').map(paragraph => `<p>${escapeEmailHtml(paragraph)}</p>`).join('')) }, { idempotencyKey: `uptime-${receipt.id}` })
      if (error) throw new Error(error.message)
      if (!data?.id) throw new Error('Email provider did not confirm acceptance')
      await prisma.uptimeNotification.updateMany({ where: { id: receipt.id, leaseUntil }, data: {
        status: 'SENT', sentAt: new Date(), providerId: data?.id ?? null, lastError: null, leaseUntil: null,
      } })
    } catch (error) {
      logger.error('Uptime notification delivery failed', { receiptId: receipt.id, error: error instanceof Error ? error.message : 'delivery unavailable' })
      await prisma.uptimeNotification.updateMany({ where: { id: receipt.id, leaseUntil }, data: {
        status: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Delivery unavailable', leaseUntil: null,
        nextAttemptAt: new Date(now.getTime() + Math.min(6 * 60 * 60_000, 5 * 60_000 * 2 ** receipt.attempts)),
      } })
    }
  }
}
