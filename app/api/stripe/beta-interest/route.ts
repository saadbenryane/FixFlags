import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resend } from '@/lib/email/client'
import { BRAND, SITE_URL } from '@/lib/marketing/copy'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? `${BRAND.name} <hello@fixflags.com>`
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL

const schema = z.object({
  email: z.string().email(),
  plan: z.enum(['BUILDER', 'TEAM']).optional(),
  name: z.string().max(100).optional(),
})

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'beta_interest',
      identifier: requestClientId(req.headers),
      limit: 5,
      windowSeconds: 60,
    })

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return apiError('Enter a valid email address', 400, { code: 'INVALID_EMAIL' })
    }

    const { email, plan, name } = parsed.data
    const planLabel = plan === 'TEAM' ? 'Studio' : plan === 'BUILDER' ? 'Pro' : 'paid plan'

    if (!ADMIN_EMAIL) {
      return apiError('Beta interest is not configured yet', 503, { code: 'ADMIN_NOT_CONFIGURED' })
    }

    if (!resend) {
      return apiError('Email service is not configured', 503, { code: 'EMAIL_NOT_CONFIGURED' })
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `[${BRAND.name}] Beta interest: ${email} wants ${planLabel}`,
      html: `
        <p>Someone is interested in upgrading to <strong>${planLabel}</strong>.</p>
        <p>Email: <a href="mailto:${email}">${email}</a>${name ? `<br />Name: ${name}` : ''}</p>
        <p>Plan requested: ${planLabel}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        <p style="font-size: 13px; color: #6b7280;">
          <a href="${SITE_URL}/admin/users">Open admin users</a> to grant access.
        </p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleRouteError(error, 'Could not submit beta interest')
  }
}
