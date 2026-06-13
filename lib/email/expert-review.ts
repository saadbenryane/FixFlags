import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'QualityOS <hello@qualityos.com>'
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

export async function notifyExpertReviewPaid(params: {
  email: string
  auditId?: string | null
  orderId: string
}): Promise<void> {
  if (!resend || !ADMIN_EMAIL) return

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const auditLink = params.auditId ? `${appUrl}/audit/${params.auditId}` : 'No audit linked'

  await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `Expert Review paid — ${params.email}`,
    html: `
      <p>New Expert Review order <strong>${params.orderId}</strong></p>
      <p>Customer: ${params.email}</p>
      <p>Audit: ${auditLink}</p>
    `,
  })
}
