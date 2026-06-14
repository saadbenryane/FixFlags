import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe, resolveCheckoutPriceId } from '@/lib/stripe'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'

const schema = z.object({
  plan: z.enum(['BUILDER', 'TEAM', 'STUDIO']),
  useFounding: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to start checkout', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Select a valid plan', 400, { code: 'INVALID_PLAN' })

    const plan = parsed.data.plan
    const useFounding = parsed.data.useFounding !== false
    const priceId = resolveCheckoutPriceId(plan, useFounding)
    if (!priceId) return apiError('This plan is not configured for checkout', 503, { code: 'BILLING_NOT_CONFIGURED' })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const checkoutSession = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: user?.stripeCustomerId ?? undefined,
    customer_email: user?.stripeCustomerId ? undefined : session.user.email,
    success_url: `${appUrl}/dashboard?upgraded=1&plan=${plan}`,
    cancel_url: `${appUrl}/pricing`,
    metadata: {
      userId: session.user.id,
      plan,
      founding: useFounding && !!PLAN_DEFINITIONS[plan].foundingPriceId ? '1' : '0',
    },
    subscription_data: {
      metadata: {
        userId: session.user.id,
        plan,
      },
    },
  })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    return handleRouteError(error, 'Could not start checkout')
  }
}
