import { Prisma } from '@prisma/client'
import { resend } from '@/lib/email/client'
import { prisma } from '@/lib/db'
import { NURTURE_EMAILS, NEWSLETTER_EMAIL, KEEP_REPORT_EMAIL, type NurtureEmailType } from './templates'
import { isReservedEmailRecipient } from './recipient'
import { FROM_EMAIL } from './from'
import { emailContent } from './content'
import { assertNotificationReplayWindow, NOTIFICATION_REQUEST_TIMEOUT_MS, notificationEmailBody, notificationEmailSnapshotSchema, notificationRetryAt, prepareNotificationReplay, sendNotificationEmail } from './notification-delivery'
import { notificationRecipientAllowed, projectEmailAcceptance } from './delivery-events'
import { productTipsUnsubscribeUrl } from './unsubscribe'

export async function sendNurtureEmail(userId: string, emailType: NurtureEmailType): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) return { sent: false, reason: 'RESEND_API_KEY not configured' }
  const now = new Date()
  const existing = await prisma.emailLog.findUnique({ where: { userId_emailType: { userId, emailType } } })
  if (existing?.status === 'SENT') return { sent: false, reason: 'already_sent' }
  if (existing?.leaseUntil && existing.leaseUntil > now) return { sent: false, reason: 'delivery_in_progress' }
  if ((existing?.attempts ?? 0) >= 5) return { sent: false, reason: 'delivery_attempts_exhausted' }
  if (existing?.nextAttemptAt && existing.nextAttemptAt > now) return { sent: false, reason: 'retry_scheduled' }
  const user = await prisma.user.findUnique({ where: { id: userId },
    select: { email: true, emailVerified: true, name: true, lifecycleStatus: true, notificationPreference: { select: { productTips: true } } } })
  if (!user) return { sent: false, reason: 'user_not_found' }
  if (user.lifecycleStatus !== 'ACTIVE') return { sent: false, reason: 'account_unavailable' }
  if (!user.emailVerified) return { sent: false, reason: 'email_not_verified' }
  if (isReservedEmailRecipient(user.email)) return { sent: false, reason: 'reserved_recipient_domain' }
  const promotional = emailType !== 'welcome'
  if (promotional && !user.notificationPreference?.productTips) return { sent: false, reason: 'product_tips_disabled' }
  if (!await notificationRecipientAllowed(user.email)) return { sent: false, reason: 'recipient_suppressed' }
  const log = await prisma.emailLog.upsert({ where: { userId_emailType: { userId, emailType } },
    create: { userId, emailType, status: 'PENDING' }, update: {} })
  if (log.status === 'SENT') return { sent: false, reason: 'already_sent' }
  const available = { id: log.id, status: log.status, attempts: log.attempts,
    OR: [{ leaseUntil: null }, { leaseUntil: { lte: now } }] }
  let payload
  try {
    if (log.payload != null) payload = notificationEmailSnapshotSchema.parse(log.payload)
    else {
      const template = NURTURE_EMAILS[emailType]
      const unsubscribeUrl = promotional ? productTipsUnsubscribeUrl(userId, user.email) : undefined
      const html = emailType === 'welcome' ? NURTURE_EMAILS.welcome.html(user.name ?? '') :
        NURTURE_EMAILS[emailType].html(user.name ?? '', unsubscribeUrl)
      payload = notificationEmailSnapshotSchema.parse({ version: 1, from: FROM_EMAIL, to: user.email,
        subject: template.subject, ...emailContent(html), tags: [{ name: 'type', value: 'onboarding' }],
        ...(!existing ? { firstAttemptAt: now.toISOString() } : {}),
        ...(unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}) })
    }
    if (payload.to !== user.email) return { sent: false, reason: 'recipient_changed' }
    payload = prepareNotificationReplay(payload, now, log.sentAt)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Email preparation unavailable'
    await prisma.emailLog.updateMany({ where: available, data: { status: 'FAILED', attempts: { increment: 1 },
      errorMsg: reason.slice(0, 500), nextAttemptAt: notificationRetryAt(log.attempts + 1, now) } })
    return { sent: false, reason }
  }
  const leaseUntil = new Date(now.getTime() + 60_000)
  const claimed = await prisma.emailLog.updateMany({ where: { ...available,
    payload: { equals: log.payload ?? Prisma.DbNull }, user: { lifecycleStatus: 'ACTIVE', emailVerified: true, email: user.email,
      ...(promotional ? { notificationPreference: { productTips: true } } : {}) } },
  data: { status: 'PENDING', attempts: { increment: 1 }, payload, leaseUntil } })
  if (!claimed.count) return { sent: false, reason: 'delivery_changed' }
  const owned = { id: log.id, status: 'PENDING' as const, attempts: log.attempts + 1, leaseUntil }
  try {
    if (leaseUntil.getTime() - Date.now() <= NOTIFICATION_REQUEST_TIMEOUT_MS) throw new Error('Email claim has insufficient delivery time')
    assertNotificationReplayWindow(payload.firstAttemptAt, new Date())
    const providerId = await sendNotificationEmail(resend, notificationEmailBody(payload), `fixflags-nurture-${userId}-${emailType}`)
    const recorded = await prisma.emailLog.updateMany({ where: owned, data: { status: 'SENT', providerId, sentAt: new Date(),
      errorMsg: null, leaseUntil: null, nextAttemptAt: null } })
    if (recorded.count) await projectEmailAcceptance({ providerId, userId, email: payload.to, channel: 'onboarding', sourceId: log.id,
      acceptedAt: new Date(), firstAttemptAt: new Date(payload.firstAttemptAt!) })
    return { sent: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Email delivery unavailable'
    await prisma.emailLog.updateMany({ where: owned, data: { status: 'FAILED', errorMsg: reason.slice(0, 500),
      leaseUntil: null, nextAttemptAt: notificationRetryAt(log.attempts + 1, new Date()) } })
    return { sent: false, reason }
  }
}

export async function sendNewsletterConfirmation(
  email: string
): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: NEWSLETTER_EMAIL.subject,
      ...emailContent(NEWSLETTER_EMAIL.html()),
    })

    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function sendKeepReportEmail(
  email: string,
  reportUrl: string
): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: KEEP_REPORT_EMAIL.subject,
      ...emailContent(KEEP_REPORT_EMAIL.html(reportUrl)),
    })
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Email provider did not confirm acceptance')
    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
