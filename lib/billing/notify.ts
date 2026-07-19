import { resend } from '@/lib/email/client'
import { BRAND } from '@/lib/marketing/copy'
import { logger } from '@/lib/logger'
import { getAppUrl } from '@/lib/get-app-url'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

export async function notifyAdminPaymentFailed(input: {
  userId: string
  email?: string | null
  subscriptionId: string
}): Promise<void> {
  if (!ADMIN_EMAIL) {
    logger.warn('ADMIN_NOTIFICATION_EMAIL not set; skipping payment_failed alert', {
      userId: input.userId,
    })
    return
  }
  if (!resend) {
    logger.warn('RESEND_API_KEY not set; skipping payment_failed alert', {
      userId: input.userId,
    })
    return
  }

  const appUrl = getAppUrl()
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[${BRAND.name}] Subscription payment failed`,
      html: `
        <p>A subscription payment failed.</p>
        <p>User: <code>${input.userId}</code>${input.email ? ` (${input.email})` : ''}</p>
        <p>Subscription: <code>${input.subscriptionId}</code></p>
        <p><a href="${appUrl}/admin/users">Open admin users</a></p>
      `,
    })
  } catch (error) {
    logger.error('Failed to send payment_failed admin email', {
      userId: input.userId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
