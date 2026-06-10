import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { stripe, STRIPE_PRICE_IDS } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { Plan } from '@prisma/client'

const schema = z.object({
  plan: z.enum(['BUILDER', 'TEAM', 'STUDIO']),
})

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const priceId = STRIPE_PRICE_IDS[parsed.data.plan as Plan]
  if (!priceId) return NextResponse.json({ error: 'Price not configured' }, { status: 500 })

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    customer: user?.stripeCustomerId ?? undefined,
    customer_email: user?.stripeCustomerId ? undefined : session.user.email,
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/pricing`,
    client_reference_id: session.user.id,
    metadata: { userId: session.user.id },
    subscription_data: { metadata: { userId: session.user.id } },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
