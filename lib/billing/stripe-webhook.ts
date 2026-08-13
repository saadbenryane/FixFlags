import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import type {
  Plan,
  Prisma,
  SubscriptionLifecycleType,
  SubscriptionStatus,
} from '@prisma/client'
import { applyPlanLimits } from '@/lib/billing/limits'
import { refundPurchasedCredit } from '@/lib/billing/credits'
import { notifyAdminPaymentFailed, notifyUserPaymentFailed } from '@/lib/billing/notify'
import { markWaitlistConverted } from '@/lib/billing/waitlist'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getStripe, planFromPriceId } from '@/lib/stripe'

export class StripeWebhookProcessError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'StripeWebhookProcessError'
  }
}

function payloadHash(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex')
}

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
  const value = (subscription as unknown as { current_period_end?: number }).current_period_end
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
  const paidPlan = priceIds.reduce<Plan | null>((found, id) => found ?? planFromPriceId(id), null)
  const status = entitlementStatus(subscription.status)
  const periodEnd = subscriptionPeriodEnd(subscription)
  const resetUsage =
    periodEnd !== null &&
    user.stripeCurrentPeriodEnd !== null &&
    periodEnd > user.stripeCurrentPeriodEnd
  const effectivePlan: Plan = paidPlan && hasPaidEntitlement(status) ? paidPlan : 'FREE'

  await applyPlanLimits(user.id, effectivePlan, tx)
  await tx.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceIds[0] ?? null,
      stripeCurrentPeriodEnd: periodEnd,
      subscriptionStatus: status,
      ...(resetUsage ? { auditsUsed: 0, deepReviewsUsed: 0 } : {}),
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

async function applyWaitlistConversion(
  tx: Prisma.TransactionClient,
  result: Awaited<ReturnType<typeof processSubscription>>
): Promise<void> {
  if (!hasPaidEntitlement(result.status)) return
  if (result.plan !== 'BUILDER' && result.plan !== 'TEAM') return
  await markWaitlistConverted(result.userId, result.plan, tx)
}

async function recordSubscriptionLifecycle(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
  type: SubscriptionLifecycleType,
  subscription: Stripe.Subscription,
  result: Awaited<ReturnType<typeof processSubscription>>
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

export async function processStripeWebhookEvent(event: Stripe.Event, rawBody: string) {
  const existing = await prisma.processedStripeEvent.findUnique({ where: { id: event.id } })
  if (existing) {
    const currentHash = payloadHash(rawBody)
    if (existing.payloadHash && existing.payloadHash !== currentHash) {
      logger.error('Stripe webhook replay with mismatched payload hash', {
        stripeEventId: event.id,
      })
      throw new StripeWebhookProcessError('Payload hash mismatch', 409)
    }
    return { received: true as const, replay: true as const }
  }

  type PaymentFailedNotify = {
    userId: string
    email: string | null
    subscriptionId: string
  }
  const paymentFailedBox: { current: PaymentFailedNotify | null } = { current: null }
  const replayBox = { current: false }

  await prisma.$transaction(async (tx) => {
    const alreadyProcessed = await tx.processedStripeEvent.findUnique({
      where: { id: event.id },
    })
    if (alreadyProcessed) {
      if (alreadyProcessed.payloadHash && alreadyProcessed.payloadHash !== payloadHash(rawBody)) {
        throw new StripeWebhookProcessError('Payload hash mismatch', 409)
      }
      replayBox.current = true
      return
    }

    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object
        const result = await processSubscription(tx, subscription)
        await applyWaitlistConversion(tx, result)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_CREATED', subscription, result)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const result = await processSubscription(tx, subscription)
        await applyWaitlistConversion(tx, result)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_UPDATED', subscription, result)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const result = await processSubscription(tx, subscription)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_DELETED', subscription, result)
        break
      }
      case 'invoice.payment_failed': {
        const synced = await syncSubscriptionFromInvoice(tx, event.data.object)
        if (synced) {
          await recordSubscriptionLifecycle(
            tx,
            event,
            'PAYMENT_FAILED',
            synced.subscription,
            synced.result
          )
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
          await recordSubscriptionLifecycle(
            tx,
            event,
            'PAYMENT_SUCCEEDED',
            synced.subscription,
            synced.result
          )
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
        if (typeof charge.payment_intent === 'string') {
          await refundPurchasedCredit(tx, charge.payment_intent)
        }
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.metadata?.type === 'credit_pack') {
          const existingPurchase = await tx.creditPurchase.findUnique({
            where: { stripeSessionId: session.id },
          })
          if (existingPurchase && existingPurchase.status === 'PAID') break
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
      data: { id: event.id, type: event.type, payloadHash: payloadHash(rawBody) },
    })
  })

  if (replayBox.current) return { received: true as const, replay: true as const }

  const failedPayment = paymentFailedBox.current
  if (failedPayment) {
    await notifyAdminPaymentFailed(failedPayment)
    if (failedPayment.email) await notifyUserPaymentFailed({ email: failedPayment.email })
  }

  return { received: true as const }
}
