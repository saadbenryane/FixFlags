import { NextRequest, NextResponse } from 'next/server'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { applyPlanLimits } from '@/lib/billing/limits'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return NextResponse.json({ error: `Webhook error: ${(err as Error).message}` }, { status: 400 })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object
      const plan = planFromPriceId(sub.items.data[0]?.price.id ?? '')
      if (plan) {
        const periodEnd = new Date(((sub as unknown) as Record<string, number>).current_period_end * 1000)
        const users = await prisma.user.findMany({
          where: { stripeCustomerId: sub.customer as string },
          select: { id: true, stripeCurrentPeriodEnd: true },
        })

        for (const u of users) {
          const resetUsage =
            u.stripeCurrentPeriodEnd && periodEnd > u.stripeCurrentPeriodEnd

          await applyPlanLimits(u.id, plan)

          await prisma.user.update({
            where: { id: u.id },
            data: {
              stripeSubscriptionId: sub.id,
              stripePriceId: sub.items.data[0]?.price.id,
              stripeCurrentPeriodEnd: periodEnd,
              ...(resetUsage ? { auditsUsed: 0 } : {}),
            },
          })
        }
      }
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object
      const users = await prisma.user.findMany({
        where: { stripeSubscriptionId: sub.id },
        select: { id: true },
      })

      await prisma.user.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: {
          stripeSubscriptionId: null,
          stripePriceId: null,
          stripeCurrentPeriodEnd: null,
        },
      })

      for (const u of users) {
        await applyPlanLimits(u.id, 'FREE')
      }
      break
    }
    case 'checkout.session.completed': {
      const session = event.data.object
      if (session.customer_email) {
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
