import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { NURTURE_EMAILS, type NurtureEmailType } from './templates'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'QualityOS <hello@qualityos.com>'

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
  if (existing) {
    return { sent: false, reason: 'already_sent' }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, plan: true },
  })
  if (!user) {
    return { sent: false, reason: 'user_not_found' }
  }

  const template = NURTURE_EMAILS[emailType]
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: template.subject,
    html: template.html(user.name ?? ''),
  })

  if (error) {
    return { sent: false, reason: error.message }
  }

  await prisma.emailLog.create({
    data: { userId, emailType },
  })

  return { sent: true }
}
