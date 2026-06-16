import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { sendNewsletterConfirmation } from '@/lib/email/send'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'

const subscribeSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  source: z.string().trim().max(64).optional(),
})

export async function POST(request: Request) {
  try {
    const clientId = requestClientId(request.headers)
    const rate = await recordRateLimit({
      scope: 'newsletter_subscribe',
      identifier: clientId,
      limit: 5,
      windowSeconds: 3600,
    })
    if (rate.exceeded) {
      return apiError('Too many attempts. Try again later.', 429, { code: 'RATE_LIMITED' })
    }

    const body = await request.json()
    const parsed = subscribeSchema.safeParse(body)
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid email', 400, { code: 'INVALID_EMAIL' })
    }

    const email = parsed.data.email.toLowerCase()
    const source = parsed.data.source ?? 'footer'

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })
    if (existing?.status === 'CONFIRMED') {
      return NextResponse.json({ ok: true, status: 'already_subscribed' })
    }

    const sendResult = await sendNewsletterConfirmation(email)
    if (!sendResult.sent) {
      return apiError(
        sendResult.reason === 'RESEND_API_KEY not configured'
          ? 'Newsletter is not configured yet. Email hello@fixflags.com instead.'
          : 'Could not send confirmation email. Try again later.',
        503,
        { code: 'EMAIL_UNAVAILABLE' }
      )
    }

    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        status: 'CONFIRMED',
        source,
        confirmedAt: new Date(),
      },
      update: {
        status: 'CONFIRMED',
        source,
        confirmedAt: new Date(),
      },
    })

    return NextResponse.json({ ok: true, status: 'subscribed' })
  } catch (error) {
    return handleRouteError(error)
  }
}
