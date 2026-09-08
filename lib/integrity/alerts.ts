import { trackEvent } from '@/lib/analytics/events'
import { BRAND } from '@/lib/marketing/copy'
import { resend } from '@/lib/email/client'
import { logger } from '@/lib/logger'
import { decryptSecret } from '@/lib/security/crypto'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

export async function sendIntegrityAlert(input: {
  shop: { email: string | null; slackWebhookEncrypted: string | null; name: string | null; shopDomain?: string }
  pathLabel: string
  health: 'GREEN' | 'RED' | 'UNKNOWN'
  reason: string
  videoUrl: string | null
  gifUrl: string | null
  screenshotUrl: string | null
}): Promise<void> {
  if (input.health === 'UNKNOWN') return
  const subject =
    input.health === 'RED'
      ? `Customers can't buy: ${input.pathLabel}`
      : `Recovered: ${input.pathLabel} can take orders again`
  const proof = input.videoUrl || input.gifUrl || input.screenshotUrl || ''
  const text = [
    subject,
    `Store: ${input.shop.name ?? 'your store'}`,
    `Reason: ${input.reason}`,
    proof ? `Proof: ${proof}` : '',
    'FixFlags confirmed this twice before sending.',
  ]
    .filter(Boolean)
    .join('\n')
  if (input.health === 'RED') {
    trackEvent('shopify_alert_sent', { shop: input.shop.shopDomain, health: 'RED' })
  } else {
    trackEvent('shopify_recovery_sent', { shop: input.shop.shopDomain })
  }

  if (input.shop.email && resend) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: input.shop.email,
      subject,
      text,
    })
  }

  if (input.shop.slackWebhookEncrypted) {
    try {
      const webhook = decryptSecret(input.shop.slackWebhookEncrypted)
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${subject}\n${proof}` }),
      })
    } catch (error) {
      logger.warn('Slack integrity alert failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
