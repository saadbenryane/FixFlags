import { NextRequest, NextResponse } from 'next/server'
import { stripe, planFromPriceId, PLAN_LIMITS } from '@/lib/stripe'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${(err as Error).message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const plan = planFromPriceId(sub.items.data[0]?.price.id ?? '')
      if (plan) {
        // Match by customer ID, or by the userId we attach at checkout —
        // subscription events can arrive before checkout.session.completed
        // links the customer to the user.
        const userId = sub.metadata?.userId
        await prisma.user.updateMany({
          where: userId
            ? { OR: [{ id: userId }, { stripeCustomerId: sub.customer as string }] }
            : { stripeCustomerId: sub.customer as string },
          data: {
            plan,
            stripeCustomerId: sub.customer as string,
            stripeSubscriptionId: sub.id,
            stripePriceId: sub.items.data[0]?.price.id,
            stripeCurrentPeriodEnd: new Date(((sub as unknown) as Record<string, number>).current_period_end * 1000),
            auditsLimit: PLAN_LIMITS[plan].audits,
          },
        })
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      await prisma.user.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          plan: 'FREE',
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
          auditsLimit: PLAN_LIMITS.FREE.audits,
        },
      })
      break
    }
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId ?? session.client_reference_id
      if (userId) {
        await prisma.user.updateMany({
          where: { id: userId },
          data: { stripeCustomerId: session.customer as string },
        })
      } else if (session.customer_email) {
        await prisma.user.updateMany({
          where: { email: session.customer_email },
          data: { stripeCustomerId: session.customer as string },
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
