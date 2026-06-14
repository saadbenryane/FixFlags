import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe, getExpertReviewStripePriceId } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'

const schema = z.object({
  auditId: z.string().min(1),
  email: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to purchase Expert Review', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

  const priceId = getExpertReviewStripePriceId()
    if (!priceId) return apiError('Expert Review is not configured', 503, { code: 'BILLING_NOT_CONFIGURED' })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Select a completed audit for review', 400, { code: 'INVALID_REQUEST' })

  const email = parsed.data.email ?? session.user.email
  const audit = await prisma.audit.findUnique({
    where: { id: parsed.data.auditId },
    select: { userId: true, status: true },
  })
  if (!audit || audit.userId !== session.user.id || audit.status !== 'COMPLETED') {
    return apiError('Select one of your completed audits', 400, { code: 'INVALID_AUDIT', action: 'select_audit' })
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: user?.stripeCustomerId ?? undefined,
    customer_email: user?.stripeCustomerId ? undefined : email,
    success_url: `${appUrl}/dashboard?expert_review=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: {
      type: 'expert_review',
      userId: session.user.id,
      auditId: parsed.data.auditId ?? '',
      email,
    },
  })

  await prisma.expertReviewOrder.create({
    data: {
      userId: session.user.id,
      email,
      auditId: parsed.data.auditId,
      stripeSessionId: checkoutSession.id,
      status: 'PENDING',
    },
  })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    return handleRouteError(error, 'Could not start Expert Review checkout')
  }
}
