import { prisma } from '@/lib/db'
import { createHash } from 'node:crypto'
import { trackEvent } from '@/lib/analytics/events'
import { BRAND } from '@/lib/marketing/copy'
import { resend } from '@/lib/email/client'
import { sendNotificationEmail } from '@/lib/email/notification-delivery'
import { logger } from '@/lib/logger'
import { decryptSecret } from '@/lib/security/crypto'
import { integrityPathWhere, type IntegrityPathAuthority } from './path-authority'

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`

/** Notification admission follows the exact committed observation and live grant. */
export async function sendIntegrityAlert(input: { authority: IntegrityPathAuthority; runId: string }): Promise<void> {
  const source = await prisma.verificationRun.findUnique({ where: { id: input.runId } })
  if (!source || source.pathId !== input.authority.id || source.health === 'UNKNOWN' || !source.confirmed) return
  const current = () => prisma.revenuePath.findFirst({ where: { ...integrityPathWhere(input.authority),
    lastVerificationRunId: source.id, lastVerifiedAt: source.createdAt, health: source.health, reason: source.reason }, include: { shop: true } })
  const evidence = source.evidence && typeof source.evidence === 'object' && !Array.isArray(source.evidence) ? source.evidence : {}
  const steps = Array.isArray(evidence.steps) ? evidence.steps : []
  const last = steps.at(-1)
  const screenshot = last && typeof last === 'object' && !Array.isArray(last) && typeof last.screenshotUrl === 'string' ? last.screenshotUrl : ''
  const proof = source.videoUrl || source.gifUrl || screenshot
  const textFor = (path: { label: string; shop: { name: string | null } }) => {
    const subject = source.health === 'RED' ? `Customers can't buy: ${path.label}` : `Recovered: ${path.label} reaches checkout again`
    return { subject, text: [subject, `Store: ${path.shop.name ?? 'your store'}`, `Reason: ${source.reason}`,
      proof ? `Proof: ${proof}` : '',
      source.health === 'RED' && typeof evidence.attemptCount === 'number' && evidence.attemptCount >= 2
        ? 'FixFlags confirmed this in two independent attempts.'
        : source.health === 'GREEN' ? 'FixFlags observed checkout in a fresh browser session.' : 'FixFlags confirmed a failed purchase attempt.',
    ].filter(Boolean).join('\n') }
  }
  let accepted = false, shopDomain: string | undefined, emailFailure: unknown
  const emailAdmission = await current()
  if (emailAdmission?.shop.email && resend) {
    const payload = textFor(emailAdmission)
    const message = { from: FROM_EMAIL, to: emailAdmission.shop.email, ...payload }
    const digest = createHash('sha256').update(JSON.stringify(message)).digest('hex')
    try {
      await sendNotificationEmail(resend, message, `fixflags-integrity-${source.id}-${digest}`)
      accepted = true; shopDomain = emailAdmission.shop.shopDomain
    } catch (error) { emailFailure = error }
  }
  // Email can wait on a provider. Slack admission rechecks revocation, recipient
  // preferences and whether this source is still the latest observation.
  const slackAdmission = await current()
  if (slackAdmission?.shop.slackWebhookEncrypted) {
    try {
      const webhook = new URL(decryptSecret(slackAdmission.shop.slackWebhookEncrypted))
      if (webhook.origin !== 'https://hooks.slack.com' || !webhook.pathname.startsWith('/services/') || webhook.username || webhook.password)
        throw new Error('Unsupported Slack webhook destination')
      const payload = textFor(slackAdmission)
      const sent = await fetch(webhook.href, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: payload.text }), signal: AbortSignal.timeout(10_000), redirect: 'error' })
      if (!sent.ok) throw new Error('Integrity Slack provider did not accept the message')
      accepted = true; shopDomain = slackAdmission.shop.shopDomain
    } catch (error) {
      logger.warn('Slack integrity alert failed', { error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (accepted) {
    if (source.health === 'RED') trackEvent('shopify_alert_sent', { shop: shopDomain, health: 'RED' })
    else trackEvent('shopify_recovery_sent', { shop: shopDomain })
  }
  if (emailFailure) {
    logger.warn('Integrity email admission failed', { error: emailFailure instanceof Error ? emailFailure.message : String(emailFailure) })
    if (!accepted) throw emailFailure
  }
}
