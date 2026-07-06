import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { BRAND } from '@/lib/marketing/copy'
import { getAppUrl } from '@/lib/get-app-url'
import { logger } from '@/lib/logger'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`
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
  // Called from inside the same DB transaction that marks the order PAID
  // (app/api/webhooks/stripe/route.ts). Throwing here would roll back that
  // status update - permanently, since Stripe's webhook retries hit this exact
  // same missing data every time - silently erasing a real customer's payment
  // confirmation. userId/auditId are nullable via onDelete: SetNull (the user
  // or audit can be deleted after the order was placed), so log and skip the
  // notification instead of failing the whole transaction over an edge case
  // that has nothing to do with whether the payment itself succeeded.
  if (!params.userId || !params.auditId) {
    logger.error('Expert Review order missing user or audit; skipping notification', {
      orderId: params.orderId,
      userId: params.userId,
      auditId: params.auditId,
    })
    return
  }

  const appUrl = getAppUrl()
  const auditLink = `${appUrl}/report/${params.auditId}`
  await sendOnce({
    userId: params.userId,
    emailType: `expert-review-paid:${params.orderId}`,
    to: params.email,
    subject: 'Expert Review confirmed, we will respond within 48 hours',
    html: `
      <p>Thanks for requesting an Expert Review from ${BRAND.name}.</p>
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
      subject: `Expert Review paid - ${params.email}`,
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
  const appUrl = getAppUrl()
  await sendOnce({
    userId: params.userId,
    emailType: `expert-review-delivered:${params.orderId}`,
    to: params.email,
    subject: `Your ${BRAND.name} Expert Review is ready`,
    html: `
      <p>Your Expert Review is ready.</p>
      <p><a href="${appUrl}/billing/reviews/${params.orderId}">Read the review and prioritized fix list</a></p>
    `,
  })
}
