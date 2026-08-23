import { resend } from '@/lib/email/client'
import { prisma } from '@/lib/db'
import { NURTURE_EMAILS, NEWSLETTER_EMAIL, KEEP_REPORT_EMAIL, type NurtureEmailType } from './templates'
import { BRAND } from '@/lib/marketing/copy'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export async function sendNurtureEmail(
  userId: string,
  emailType: NurtureEmailType
): Promise<{ sent: boolean; reason?: string }> {
  if (!resend) {
    return { sent: false, reason: 'RESEND_API_KEY not configured' }
  }

  const existing = await prisma.emailLog.findUnique({
    where: { userId_emailType: { userId, emailType } },
  })
  if (existing && existing.status !== 'FAILED') {
    return { sent: false, reason: 'already_sent' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  })
  if (!user) {
    return { sent: false, reason: 'user_not_found' }
  }

  await prisma.emailLog.upsert({
    where: { userId_emailType: { userId, emailType } },
    create: { userId, emailType, status: 'PENDING' },
    update: { status: 'PENDING', errorMsg: null },
  })

  const template = NURTURE_EMAILS[emailType]
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: template.subject,
      html: template.html(user.name ?? ''),
    })

    if (error) throw new Error(error.message)

    await prisma.emailLog.update({
      where: { userId_emailType: { userId, emailType } },
      data: {
        status: 'SENT',
        providerId: data?.id ?? null,
        sentAt: new Date(),
      },
    })
    return { sent: true }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    await prisma.emailLog.update({
      where: { userId_emailType: { userId, emailType } },
      data: { status: 'FAILED', errorMsg: reason },
    })
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
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: NEWSLETTER_EMAIL.subject,
      html: NEWSLETTER_EMAIL.html(),
    })

    if (error) throw new Error(error.message)
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
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: KEEP_REPORT_EMAIL.subject,
      html: KEEP_REPORT_EMAIL.html(reportUrl),
    })
    if (error) throw new Error(error.message)
    return { sent: true }
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
