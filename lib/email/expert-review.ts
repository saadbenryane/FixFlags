import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'QualityOS <hello@qualityos.com>'
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

export async function notifyExpertReviewPaid(params: {
  email: string
  auditId?: string | null
  orderId: string
}): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const auditLink = params.auditId ? `${appUrl}/audit/${params.auditId}` : null

  if (resend) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.email,
      subject: 'Expert Review confirmed — we will respond within 48 hours',
      html: `
        <p>Thanks for requesting an Expert Review from QualityOS.</p>
        <p>We received your payment and will respond within <strong>48 hours</strong> with a written review and prioritized fix list.</p>
        ${auditLink ? `<p>Your audit: <a href="${auditLink}">${auditLink}</a></p>` : ''}
        <p>Track status anytime on your <a href="${appUrl}/billing">billing page</a>.</p>
      `,
    })
  }

  if (resend && ADMIN_EMAIL) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `Expert Review paid — ${params.email}`,
      html: `
        <p>New Expert Review order <strong>${params.orderId}</strong></p>
        <p>Customer: ${params.email}</p>
        <p>Audit: ${auditLink ?? 'No audit linked'}</p>
        <p><a href="${appUrl}/admin/expert-reviews">Fulfill in admin</a></p>
      `,
    })
  }
}
