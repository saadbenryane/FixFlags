import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { headers } from 'next/headers'
import { resend } from '@/lib/email/client'
import { WAITLIST_EMAILS } from '@/lib/email/templates'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { BRAND_HEX } from '@/lib/design/brand-spec'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { auth } from '@/lib/auth'
import { upsertPaidPlanWaitlistEntry } from '@/lib/billing/waitlist'
import { FOUNDER_OFFER_DISPLAY_NAME } from '@/lib/billing/founder-offers'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <hello@fixflags.com>`
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const schema = z.object({
  email: z.string().email().optional(),
  plan: z.enum(['BUILDER', 'TEAM']),
  name: z.string().max(100).optional(),
  source: z.string().max(64).optional(),
  campaign: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'beta_interest',
      identifier: requestClientId(req.headers),
      limit: 5,
      windowSeconds: 60,
    })

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id || !session.user.email) {
      return apiError('Sign in to join the waitlist', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError('Select a valid plan', 400, { code: 'INVALID_PLAN' })
    }

    const { plan, source, campaign } = parsed.data
    const email = session.user.email
    const planLabel = plan === 'TEAM' ? 'Studio' : 'Pro'

    await upsertPaidPlanWaitlistEntry({
      userId: session.user.id,
      plan,
      source,
      campaign,
    })

    if (resend) {
      const waitlistEmail = WAITLIST_EMAILS.joined(planLabel)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: waitlistEmail.subject,
        html: waitlistEmail.html(session.user.name ?? ''),
      })
    }

    if (ADMIN_EMAIL && resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `[${BRAND.name}] Waitlist: ${email} joined ${planLabel}`,
        html: `
          <p><strong>${email}</strong> joined the <strong>${planLabel}</strong> waitlist.</p>
          ${source ? `<p>Source: ${source}</p>` : ''}
          ${campaign ? `<p>Campaign: ${campaign}</p>` : ''}
          <p>Offer: ${FOUNDER_OFFER_DISPLAY_NAME}</p>
          <hr style="border: none; border-top: 1px solid ${BRAND_HEX.border}; margin: 16px 0;" />
          <p style="font-size: 13px; color: ${BRAND_HEX.mutedForeground};">
            <a href="${SITE_URL}/admin/waitlist">Open waitlist admin</a>
          </p>
        `,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not join the waitlist')
  }
}
