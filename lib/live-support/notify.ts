import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { BRAND } from '@/lib/marketing/copy'
import { logger } from '@/lib/logger'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000

function truncatePreview(body: string, max = 280): string {
  const trimmed = body.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export async function notifyAdminOfVisitorMessage(
  sessionId: string,
  messagePreview: string
): Promise<void> {
  if (!ADMIN_EMAIL) {
    logger.warn('ADMIN_NOTIFICATION_EMAIL not set; skipping live chat alert', { sessionId })
    return
  }
  if (!resend) {
    logger.warn('RESEND_API_KEY not set; skipping live chat alert', { sessionId })
    return
  }

  const session = await prisma.supportSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { email: true } },
      lead: { select: { normalizedDomain: true } },
    },
  })
  if (!session) return

  const now = Date.now()
  if (session.lastNotifiedAt && now - session.lastNotifiedAt.getTime() < NOTIFY_COOLDOWN_MS) {
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const inboxLink = `${appUrl}/admin/inbox?session=${sessionId}`
  const visitorLabel =
    session.visitorEmail ??
    session.user?.email ??
    session.visitorName ??
    'Anonymous visitor'
  const domainNote = session.lead?.normalizedDomain
    ? `<p>Linked lead: <strong>${session.lead.normalizedDomain}</strong></p>`
    : ''
  const preview = truncatePreview(messagePreview)

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New live chat message from ${visitorLabel}`,
    html: `
      <p>A visitor sent a message in live chat.</p>
      <p><strong>Visitor:</strong> ${visitorLabel}</p>
      <p><strong>Message:</strong> ${preview}</p>
      ${session.pageUrl ? `<p><strong>Page:</strong> ${session.pageUrl}</p>` : ''}
      ${domainNote}
      <p><a href="${inboxLink}">Open in admin inbox</a></p>
    `,
  })

  if (result.error) {
    logger.error('Live chat admin email failed', { sessionId, error: result.error.message })
    return
  }

  await prisma.supportSession.update({
    where: { id: sessionId },
    data: { lastNotifiedAt: new Date() },
  })

  logger.info('Live chat admin email sent', { sessionId, providerId: result.data?.id })
}
