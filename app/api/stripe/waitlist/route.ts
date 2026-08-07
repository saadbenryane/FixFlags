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
import * as waitlist from '@/lib/billing/waitlist'
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
  /** One-time invite code from /waitlist/<plan>?code=...; redeeming grants access. */
  code: z.string().min(1).max(64).optional(),
})

function tierAdminLabel(tier: number | null): string {
  if (tier === 1 || tier === 2) {
    return `Tier ${tier} (${TIER_PERCENT[tier]}% off)`
  }
  return 'No tier (list price)'
}

function batchAdminLabel(batch: number | null): string {
  return batch == null ? 'Unassigned' : `Batch ${batch}`
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

/** Best-effort admin notification; never blocks the join. */
async function notifyAdmin(html: string): Promise<void> {
  if (!ADMIN_EMAIL || !resend) return
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[${BRAND.name}] Waitlist: new join`,
      html,
    })
  } catch (error) {
    logger.warn('Could not send waitlist admin notification', error)
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

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError('Select a valid plan', 400, { code: 'INVALID_PLAN' })
    }

    const { plan, source, campaign, code } = parsed.data
    const planLabel = plan === 'TEAM' ? 'Studio' : 'Pro'

    // One-time invite redeem (signed-in or email-only). Grants immediate access.
    if (code) {
      const sessionEmail = session?.user?.email
      const redeemEmail =
        parsed.data.email?.trim() || sessionEmail
      const redeemed = await waitlist.redeemInvite({
        code,
        plan,
        userId: session?.user?.id,
        email: redeemEmail,
      })
      if (!redeemed.ok) {
        const message: Record<waitlist.RedeemInviteFailure, string> = {
          NOT_FOUND: 'This invite link is not valid. Join the waitlist to hold your spot.',
          PLAN_MISMATCH:
            'This invite link is for the other plan. Open the invite for the plan you chose.',
          REVOKED: 'This invite link has been revoked. Join the waitlist to hold your spot.',
          ALREADY_REDEEMED:
            'This invite link has already been used. Checkout may already be open for you.',
          EMAIL_REQUIRED: 'Enter your email to redeem this invite link.',
        }
        return apiError(message[redeemed.reason], 400, {
          code: 'INVITE_REDEEM_FAILED',
        })
      }

      const to = redeemEmail
      if (resend && to) {
        const waitlistEmail = WAITLIST_EMAILS.joined(planLabel)
        await resend.emails.send({
          from: FROM_EMAIL,
          to,
          subject: waitlistEmail.subject,
          html: waitlistEmail.html(session?.user?.name ?? ''),
        })
      }
      await notifyAdmin(`
        <p><strong>${to ?? 'unknown'}</strong> redeemed an invite for <strong>${planLabel}</strong>.</p>
        <p>Batch: ${batchAdminLabel(redeemed.batch)}. Access granted.</p>
        <hr style="border: none; border-top: 1px solid ${BRAND_HEX.border}; margin: 16px 0;" />
        <p style="font-size: 13px; color: ${BRAND_HEX.mutedForeground};">
          <a href="${SITE_URL}/admin/waitlist">Open waitlist admin</a>
        </p>
      `)
      return NextResponse.json({ ok: true, mode: 'redeemed' })
    }

    // Email-only pre-account capture: no session, email required.
    if (!session?.user?.id || !session.user.email) {
      const email = parsed.data.email?.trim()
      if (!email) {
        return apiError('Sign in to join the waitlist', 401, {
          code: 'UNAUTHORIZED',
          action: 'sign_in',
        })
      }
      await waitlist.upsertWaitlistLead({ email, plan, source, campaign })

      if (resend) {
        const waitlistEmail = WAITLIST_EMAILS.joined(planLabel)
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: waitlistEmail.subject,
          html: waitlistEmail.html(''),
        })
      }
      await notifyAdmin(`
        <p><strong>${email}</strong> joined the <strong>${planLabel}</strong> waitlist (email only, pre-account).</p>
        ${source ? `<p>Source: ${source}</p>` : ''}
        ${campaign ? `<p>Campaign: ${campaign}</p>` : ''}
        <p>They will be attached to an account on signup.</p>
        <hr style="border: none; border-top: 1px solid ${BRAND_HEX.border}; margin: 16px 0;" />
        <p style="font-size: 13px; color: ${BRAND_HEX.mutedForeground};">
          <a href="${SITE_URL}/admin/waitlist">Open waitlist admin</a>
        </p>
      `)
      return NextResponse.json({ ok: true, mode: 'lead', email })
    }

    const capturedEmail = parsed.data.email?.trim() || session.user.email

    const entry = await waitlist.upsertPaidPlanWaitlistEntry({
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

    await notifyAdmin(`
      <p><strong>${capturedEmail}</strong> joined the <strong>${planLabel}</strong> waitlist.</p>
      ${source ? `<p>Source: ${source}</p>` : ''}
      ${campaign ? `<p>Campaign: ${campaign}</p>` : ''}
      <p>Discount tier: ${tierAdminLabel(entry.discountTier as DiscountTier | null)}</p>
      <p>Batch: ${batchAdminLabel(entry.batch)}</p>
      <hr style="border: none; border-top: 1px solid ${BRAND_HEX.border}; margin: 16px 0;" />
      <p style="font-size: 13px; color: ${BRAND_HEX.mutedForeground};">
        <a href="${SITE_URL}/admin/waitlist">Open waitlist admin</a>
      </p>
    `)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not join the waitlist')
  }
}
