import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe, getExpertReviewStripePriceId } from '@/lib/stripe'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

const schema = z.object({
  auditId: z.string().optional(),
  email: z.string().email().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: 'Sign in to purchase Expert Review' }, { status: 401 })
  }

  const priceId = getExpertReviewStripePriceId()
  if (!priceId) {
    return NextResponse.json({ error: 'Expert Review is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const email = parsed.data.email ?? session.user.email
  if (parsed.data.auditId) {
    const audit = await prisma.audit.findUnique({
      where: { id: parsed.data.auditId },
      select: { userId: true },
    })
    if (!audit || audit.userId !== session.user.id) {
      return NextResponse.json({ error: 'Audit not found' }, { status: 404 })
    }
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
      auditId: parsed.data.auditId ?? null,
      stripeSessionId: checkoutSession.id,
      status: 'PENDING',
    },
  })

  return NextResponse.json({ url: checkoutSession.url })
}
