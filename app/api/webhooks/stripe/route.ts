import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type {
  Plan,
  Prisma,
  SubscriptionLifecycleType,
  SubscriptionStatus,
} from '@prisma/client'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { applyPlanLimits } from '@/lib/billing/limits'
import { refundPurchasedCredit } from '@/lib/billing/credits'
import { notifyAdminPaymentFailed, notifyUserPaymentFailed } from '@/lib/billing/notify'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

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

async function resolveSubscriptionUser(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription
) {
  const metadataUserId = subscription.metadata?.userId
  if (metadataUserId) {
    const user = await tx.user.findUnique({ where: { id: metadataUserId } })
    if (user) return user
  }
  return tx.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  })
}

function resolvePriceIds(subscription: Stripe.Subscription): string[] {
  return subscription.items.data.map((item) => item.price.id).filter(Boolean)
}

async function processSubscription(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription
): Promise<{
  userId: string
  email: string | null
  previousPlan: Plan
  plan: Plan
  status: SubscriptionStatus
  priceId: string | null
  unitAmount: number | null
  currency: string | null
}> {
  const user = await resolveSubscriptionUser(tx, subscription)
  if (!user) throw new Error(`No user found for Stripe subscription ${subscription.id}`)

  const priceIds = resolvePriceIds(subscription)
  const paidPlan = priceIds.reduce<Plan | null>((found, id) => {
    return found ?? planFromPriceId(id)
  }, null)
  const status = entitlementStatus(subscription.status)
  const periodEnd = subscriptionPeriodEnd(subscription)
  const resetUsage =
    periodEnd !== null &&
    user.stripeCurrentPeriodEnd !== null &&
    periodEnd > user.stripeCurrentPeriodEnd

  const effectivePlan: Plan =
    paidPlan && hasPaidEntitlement(status) ? paidPlan : 'FREE'
  await applyPlanLimits(user.id, effectivePlan, tx)
  await tx.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceIds[0] ?? null,
      stripeCurrentPeriodEnd: periodEnd,
      subscriptionStatus: status,
      ...(resetUsage ? { auditsUsed: 0 } : {}),
    },
  })
  const price = subscription.items.data.find((item) => planFromPriceId(item.price.id))?.price
  return {
    userId: user.id,
    email: user.email,
    previousPlan: user.plan,
    plan: effectivePlan,
    status,
    priceId: price?.id ?? priceIds[0] ?? null,
    unitAmount: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
  }
}

async function recordSubscriptionLifecycle(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
  type: SubscriptionLifecycleType,
  subscription: Stripe.Subscription,
  result: Awaited<ReturnType<typeof processSubscription>>,
): Promise<void> {
  await tx.subscriptionLifecycleEvent.create({
    data: {
      stripeEventId: event.id,
      stripeEventType: event.type,
      type,
      userId: result.userId,
      subscriptionId: subscription.id,
      customerId: String(subscription.customer),
      previousPlan: result.previousPlan,
      plan: result.plan,
      status: result.status,
      priceId: result.priceId,
      unitAmount: result.unitAmount,
      currency: result.currency,
      occurredAt: new Date(event.created * 1000),
    },
  })
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  if (!invoice.subscription) return null
  return typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription.id
}

async function syncSubscriptionFromInvoice(
  tx: Prisma.TransactionClient,
  invoice: Stripe.Invoice
): Promise<{
  subscription: Stripe.Subscription
  result: Awaited<ReturnType<typeof processSubscription>>
} | null> {
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) return null

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  const result = await processSubscription(tx, subscription)
  return { subscription, result }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ message: 'Missing Stripe signature' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json({ message: 'Stripe webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    return NextResponse.json(
      { message: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    const existing = await prisma.processedStripeEvent.findUnique({
      where: { id: event.id },
    })
    if (existing) {
      const currentHash = createHash('sha256').update(rawBody).digest('hex')
      if (existing.payloadHash && existing.payloadHash !== currentHash) {
        logger.error('Stripe webhook replay with mismatched payload hash', {
          stripeEventId: event.id,
        })
        return NextResponse.json({ message: 'Payload hash mismatch' }, { status: 409 })
      }
      return NextResponse.json({ received: true, replay: true })
    }

    type PaymentFailedNotify = {
      userId: string
      email: string | null
      subscriptionId: string
    }
    const paymentFailedBox: { current: PaymentFailedNotify | null } = { current: null }

    await prisma.$transaction(async (tx) => {
      const alreadyProcessed = await tx.processedStripeEvent.findUnique({
        where: { id: event.id },
      })
      if (alreadyProcessed) return

      switch (event.type) {
        case 'customer.subscription.created': {
          const result = await processSubscription(tx, event.data.object)
          await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_CREATED', event.data.object, result)
          break
        }
        case 'customer.subscription.updated': {
          const result = await processSubscription(tx, event.data.object)
          await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_UPDATED', event.data.object, result)
          break
        }
        case 'customer.subscription.deleted': {
          const result = await processSubscription(tx, event.data.object)
          await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_DELETED', event.data.object, result)
          break
        }

        case 'invoice.payment_failed': {
          const synced = await syncSubscriptionFromInvoice(tx, event.data.object)
          if (synced) {
            await recordSubscriptionLifecycle(tx, event, 'PAYMENT_FAILED', synced.subscription, synced.result)
            paymentFailedBox.current = {
              userId: synced.result.userId,
              email: synced.result.email,
              subscriptionId: synced.subscription.id,
            }
          }
          break
        }

        case 'invoice.payment_succeeded': {
          const synced = await syncSubscriptionFromInvoice(tx, event.data.object)
          if (synced) {
            await recordSubscriptionLifecycle(tx, event, 'PAYMENT_SUCCEEDED', synced.subscription, synced.result)
          }
          break
        }

        case 'checkout.session.expired': {
          const session = event.data.object
          if (session.metadata?.type === 'credit_pack') {
            await tx.creditPurchase.deleteMany({
              where: { stripeSessionId: session.id, status: 'PENDING' },
            })
          }
          break
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge
          const paymentIntent = charge.payment_intent
          if (typeof paymentIntent === 'string') {
            await refundPurchasedCredit(tx, paymentIntent)
          }
          break
        }

        case 'checkout.session.completed': {
          const session = event.data.object
          if (session.metadata?.type === 'credit_pack') {
            const existingPurchase = await tx.creditPurchase.findUnique({
              where: { stripeSessionId: session.id },
            })
            if (existingPurchase && existingPurchase.status === 'PAID') {
              break
            }
            if (existingPurchase) {
              await tx.creditPurchase.update({
                where: { id: existingPurchase.id },
                data: {
                  status: 'PAID',
                  creditsRemaining: existingPurchase.creditsPurchased,
                  paidAt: new Date(),
                  stripePaymentIntentId: session.payment_intent as string,
                },
              })
            } else {
              logger.error(
                `Credit pack payment completed but no local purchase record found (session: ${session.id}, user: ${session.metadata?.userId})`
              )
            }
          }

          if (session.metadata?.type === 'one_time') {
            const userId = session.metadata?.userId
            if (userId) {
              const plan = session.metadata?.plan as Plan | undefined
              if (plan === 'BUILDER') {
                await tx.user.update({
                  where: { id: userId },
                  data: {
                    plan: 'BUILDER',
                    auditsLimit: 1,
                    auditsUsed: 0,
                  },
                })
              }
            }
          }

          const userId = session.metadata?.userId
          if (userId && session.customer) {
            await tx.user.update({
              where: { id: userId },
              data: { stripeCustomerId: session.customer as string },
            })
          }
          break
        }
      }

      await tx.processedStripeEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payloadHash: createHash('sha256').update(rawBody).digest('hex'),
        },
      })
    })

    const failedPayment = paymentFailedBox.current
    if (failedPayment) {
      await notifyAdminPaymentFailed(failedPayment)
      if (failedPayment.email) {
        await notifyUserPaymentFailed({
          email: failedPayment.email,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Stripe webhook failed', {
      stripeEventId: event.id,
      stripeEventType: event.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ message: 'Webhook processing failed' }, { status: 500 })
  }
}
