import { NextResponse } from 'next/server'
import { handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { prisma } from '@/lib/db'
import { resend } from '@/lib/email/client'
import { WAITLIST_EMAILS } from '@/lib/email/templates'
import { BRAND } from '@/lib/marketing/copy'
import { markWaitlistInvited } from '@/lib/billing/waitlist'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <hello@fixflags.com>`

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const entry = await prisma.paidPlanWaitlistEntry.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    })
    if (!entry) {
      return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 })
    }

    await markWaitlistInvited(id)

    const planLabel = entry.plan === 'TEAM' ? 'Studio' : 'Pro'
    let emailSent = false
    if (resend && entry.user.email) {
      const invited = WAITLIST_EMAILS.invited(planLabel)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: entry.user.email,
        subject: invited.subject,
        html: invited.html(entry.user.name ?? ''),
      })
      emailSent = true
    }

    return NextResponse.json({ ok: true, emailSent })
  } catch (err) {
    return handleRouteError(err)
  }
}
