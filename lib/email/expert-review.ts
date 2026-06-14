import { Resend } from 'resend'
import { prisma } from '@/lib/db'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'QualityOS <hello@qualityos.com>'
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

async function sendOnce(input: {
  userId: string
  emailType: string
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!resend) throw new Error('RESEND_API_KEY is not configured')

  const existing = await prisma.emailLog.findUnique({
    where: { userId_emailType: { userId: input.userId, emailType: input.emailType } },
  })
  if (existing?.status === 'SENT') return

  const log = existing
    ? await prisma.emailLog.update({
        where: { id: existing.id },
        data: { status: 'PENDING', errorMsg: null },
      })
    : await prisma.emailLog.create({
        data: {
          userId: input.userId,
          emailType: input.emailType,
          status: 'PENDING',
        },
      })

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: input.to,
    subject: input.subject,
    html: input.html,
  })
  if (result.error) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', errorMsg: result.error.message },
    })
    throw new Error(result.error.message)
  }

  await prisma.emailLog.update({
    where: { id: log.id },
    data: { status: 'SENT', providerId: result.data?.id ?? null, sentAt: new Date() },
  })
}

export async function notifyExpertReviewPaid(params: {
  userId: string | null
  email: string
  auditId: string | null
  orderId: string
}): Promise<void> {
  if (!params.userId) throw new Error('Expert Review order is missing a user')
  if (!params.auditId) throw new Error('Expert Review order is missing an audit')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const auditLink = `${appUrl}/audit/${params.auditId}`
  await sendOnce({
    userId: params.userId,
    emailType: `expert-review-paid:${params.orderId}`,
    to: params.email,
    subject: 'Expert Review confirmed — we will respond within 48 hours',
    html: `
      <p>Thanks for requesting an Expert Review from QualityOS.</p>
      <p>We received your payment and will respond within <strong>48 hours</strong> with a written review and prioritized fix list.</p>
      <p>Your audit: <a href="${auditLink}">${auditLink}</a></p>
      <p>Track status anytime on your <a href="${appUrl}/billing">billing page</a>.</p>
    `,
  })

  if (ADMIN_EMAIL) {
    await sendOnce({
      userId: params.userId,
      emailType: `expert-review-admin:${params.orderId}`,
      to: ADMIN_EMAIL,
      subject: `Expert Review paid — ${params.email}`,
      html: `
        <p>New Expert Review order <strong>${params.orderId}</strong></p>
        <p>Customer: ${params.email}</p>
        <p>Audit: <a href="${auditLink}">${auditLink}</a></p>
        <p><a href="${appUrl}/admin/expert-reviews/${params.orderId}">Author the review</a></p>
      `,
    })
  }
}

export async function sendExpertReviewDelivered(params: {
  userId: string
  email: string
  orderId: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  await sendOnce({
    userId: params.userId,
    emailType: `expert-review-delivered:${params.orderId}`,
    to: params.email,
    subject: 'Your QualityOS Expert Review is ready',
    html: `
      <p>Your Expert Review is ready.</p>
      <p><a href="${appUrl}/billing/reviews/${params.orderId}">Read the review and prioritized fix list</a></p>
    `,
  })
}
