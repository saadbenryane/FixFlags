import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { Plan, SubscriptionStatus } from '@prisma/client'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { applyPlanLimits } from '@/lib/billing/limits'
import { prisma } from '@/lib/db'
import { notifyExpertReviewPaid } from '@/lib/email/expert-review'

function entitlementStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  if (status === 'active') return 'ACTIVE'
  if (status === 'trialing') return 'TRIALING'
  if (status === 'past_due' || status === 'paused') return 'PAST_DUE'
  if (status === 'canceled') return 'CANCELED'
  return 'UNPAID'
}

function hasPaidEntitlement(status: SubscriptionStatus): boolean {
  return status === 'ACTIVE' || status === 'TRIALING'
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const value = (subscription as unknown as { current_period_end?: number })
    .current_period_end
  return value ? new Date(value * 1000) : null
}

async function resolveSubscriptionUser(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata?.userId
  if (metadataUserId) {
    const user = await prisma.user.findUnique({ where: { id: metadataUserId } })
    if (user) return user
  }
  return prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  })
}

async function processSubscription(subscription: Stripe.Subscription): Promise<void> {
  const user = await resolveSubscriptionUser(subscription)
  if (!user) throw new Error(`No user found for Stripe subscription ${subscription.id}`)

  const priceId = subscription.items.data[0]?.price.id ?? null
  const paidPlan = priceId ? planFromPriceId(priceId) : null
  const status = entitlementStatus(subscription.status)
  const periodEnd = subscriptionPeriodEnd(subscription)
  const resetUsage =
    periodEnd !== null &&
    user.stripeCurrentPeriodEnd !== null &&
    periodEnd > user.stripeCurrentPeriodEnd

  const effectivePlan: Plan =
    paidPlan && hasPaidEntitlement(status) ? paidPlan : 'FREE'
  await applyPlanLimits(user.id, effectivePlan)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      stripeCurrentPeriodEnd: periodEnd,
      subscriptionStatus: status,
      ...(resetUsage ? { auditsUsed: 0 } : {}),
    },
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ message: 'Missing Stripe signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (error) {
    return NextResponse.json(
      { message: `Webhook signature failed: ${(error as Error).message}` },
      { status: 400 }
    )
  }

  const processed = await prisma.processedStripeEvent.findUnique({
    where: { id: event.id },
  })
  if (processed) return NextResponse.json({ received: true, replay: true })

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await processSubscription(event.data.object)
        break

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.metadata?.type === 'expert_review') {
          const order = await prisma.expertReviewOrder.update({
            where: { stripeSessionId: session.id },
            data: { status: 'PAID' },
          })
          await prisma.expertReviewEvent.createMany({
            data: [{ orderId: order.id, type: 'PAYMENT_CONFIRMED' }],
            skipDuplicates: true,
          })
          await notifyExpertReviewPaid({
            userId: order.userId,
            email: order.email,
            auditId: order.auditId,
            orderId: order.id,
          })
        }

        const userId = session.metadata?.userId
        if (userId && session.customer) {
          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          })
        }
        break
      }
    }

    await prisma.processedStripeEvent.create({
      data: {
        id: event.id,
        type: event.type,
        payloadHash: createHash('sha256').update(rawBody).digest('hex'),
      },
    })
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'stripe.webhook.failed',
        stripeEventId: event.id,
        stripeEventType: event.type,
        error: error instanceof Error ? error.message : String(error),
      })
    )
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 })
  }
}
