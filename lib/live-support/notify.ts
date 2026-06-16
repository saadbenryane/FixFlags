import { Resend } from 'resend'
import { prisma } from '@/lib/db'
import { BRAND } from '@/lib/marketing/copy'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <${BRAND.supportEmail}>`
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const NOTIFY_COOLDOWN_MS = 5 * 60 * 1000

export async function notifyAdminOfVisitorMessage(sessionId: string): Promise<void> {
  if (!ADMIN_EMAIL || !resend) return

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

  const result = await resend.emails.send({
    from: FROM_EMAIL,
    to: ADMIN_EMAIL,
    subject: `New live chat message from ${visitorLabel}`,
    html: `
      <p>A visitor sent a message in live chat.</p>
      <p><strong>Visitor:</strong> ${visitorLabel}</p>
      ${session.pageUrl ? `<p><strong>Page:</strong> ${session.pageUrl}</p>` : ''}
      ${domainNote}
      <p><a href="${inboxLink}">Open in admin inbox</a></p>
    `,
  })

  if (!result.error) {
    await prisma.supportSession.update({
      where: { id: sessionId },
      data: { lastNotifiedAt: new Date() },
    })
  }
}
