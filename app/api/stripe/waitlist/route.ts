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
import { TIER_PERCENT, type DiscountTier } from '@/lib/billing/discount-tiers'
import { logger } from '@/lib/logger'

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

function tierAdminLabel(tier: number | null): string {
  if (tier === 1 || tier === 2) {
    return `Tier ${tier} (${TIER_PERCENT[tier]}% off)`
  }
  return 'No tier (list price)'
}

/**
 * Best-effort email attachment: when the email entered on the waitlist page
 * differs from the account email (e.g. Apple SSO private relay), register it on
 * the account through better-auth. This is fire-and-forget: a failure never
 * blocks the waitlist join, and the route never reveals whether an email is
 * already registered to another account (changeEmail returns the same status
 * for both cases).
 */
async function attachEmailToAccountIfDifferent(
  userId: string,
  sessionEmail: string,
  enteredEmail: string | undefined
): Promise<void> {
  if (!enteredEmail) return
  const normalized = enteredEmail.toLowerCase()
  if (normalized === sessionEmail.toLowerCase()) return
  try {
    const requestHeaders = await headers()
    await auth.api.changeEmail({
      body: { newEmail: normalized, callbackURL: '/waitlist' },
      headers: requestHeaders,
    })
  } catch (error) {
    logger.warn(`Could not attach email ${normalized} to account ${userId}`, error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'waitlist_join',
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
    // The email captured on the waitlist page. May differ from the account
    // email (SSO private relay). Falls back to the account email.
    const capturedEmail = parsed.data.email?.trim() || session.user.email
    const planLabel = plan === 'TEAM' ? 'Studio' : 'Pro'

    const entry = await upsertPaidPlanWaitlistEntry({
      userId: session.user.id,
      plan,
      email: capturedEmail,
      source,
      campaign,
    })

    // Fire-and-forget: attach the entered email to the account when it differs
    // (SSO case). Never blocks the join and never leaks email existence.
    await attachEmailToAccountIfDifferent(session.user.id, session.user.email, capturedEmail)

    if (resend) {
      const waitlistEmail = WAITLIST_EMAILS.joined(planLabel)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: capturedEmail,
        subject: waitlistEmail.subject,
        html: waitlistEmail.html(session.user.name ?? ''),
      })
    }

    if (ADMIN_EMAIL && resend) {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `[${BRAND.name}] Waitlist: ${capturedEmail} joined ${planLabel}`,
        html: `
          <p><strong>${capturedEmail}</strong> joined the <strong>${planLabel}</strong> waitlist.</p>
          ${source ? `<p>Source: ${source}</p>` : ''}
          ${campaign ? `<p>Campaign: ${campaign}</p>` : ''}
          <p>Discount tier: ${tierAdminLabel(entry.discountTier as DiscountTier | null)}</p>
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
