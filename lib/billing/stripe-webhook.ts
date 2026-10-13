import { appendAdminActivity } from '@/lib/admin/activity'
import { createHash } from 'node:crypto'
import type Stripe from 'stripe'
import type {
  Plan,
  Prisma,
  SubscriptionLifecycleType,
  SubscriptionStatus,
} from '@prisma/client'
import { setStripeUsagePeriod } from '@/lib/billing/usage-period'
import { refundPurchasedCredit } from '@/lib/billing/credits'
import { notifyAdminPaymentFailed, notifyUserPaymentFailed } from '@/lib/billing/notify'
import { markWaitlistConverted } from '@/lib/billing/waitlist'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { getStripe, planFromPriceId } from '@/lib/stripe'
import { recordBillingSubscriptionSnapshot, recordPaidInvoice, recordProviderRefund } from './ledger'

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

function subscriptionPeriodStart(subscription: Stripe.Subscription): Date | null {
  const value = (subscription as unknown as { current_period_start?: number }).current_period_start
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
  subscription: Stripe.Subscription,
  eventOccurredAt: Date
): Promise<{
  userId: string
  email: string | null
  previousPlan: Plan
  plan: Plan
  status: SubscriptionStatus
  priceId: string | null
  unitAmount: number | null
  currency: string | null
  siteQuantity: number
  stale: boolean
}> {
  const user = await resolveSubscriptionUser(tx, subscription)
  if (!user) throw new Error(`No user found for Stripe subscription ${subscription.id}`)

  const priceIds = resolvePriceIds(subscription)
  const siteQuantity = subscription.items.data
    .filter((item) => planFromPriceId(item.price.id))
    .reduce((total, item) => total + Math.max(1, item.quantity ?? 1), 0)
  if (user.stripeSubscriptionEventAt && user.stripeSubscriptionEventAt >= eventOccurredAt) {
    return {
      userId: user.id,
      email: user.email,
      previousPlan: user.plan,
      plan: user.plan,
      status: user.subscriptionStatus,
      priceId: user.stripePriceId,
      unitAmount: null,
      currency: null,
      siteQuantity: user.licensedSiteQuantity ?? 0,
      stale: true,
    }
  }
  const mappedPlan = priceIds.reduce<Plan | null>((found, id) => found ?? planFromPriceId(id), null)
  const status = entitlementStatus(subscription.status)
  const periodStart = subscriptionPeriodStart(subscription)
  const periodEnd = subscriptionPeriodEnd(subscription)
  // Existing subscribers keep their current paid plan when Stripe sends a
  // legacy price that was already attached to this account. New checkouts use
  // the canonical current price IDs; optional legacy ID lists cover imports.
  const grandfatheredPlan =
    !mappedPlan &&
    user.plan !== 'FREE' &&
    user.stripePriceId !== null &&
    priceIds.includes(user.stripePriceId)
      ? user.plan
      : null
  const paidPlan = mappedPlan ?? grandfatheredPlan
  const effectivePlan: Plan = paidPlan && hasPaidEntitlement(status) ? paidPlan : 'FREE'
  const entitlementPriceId =
    effectivePlan === 'FREE'
      ? null
      : priceIds.find((id) => planFromPriceId(id) === effectivePlan) ?? user.stripePriceId

  await setStripeUsagePeriod(tx, {
    userId: user.id,
    plan: effectivePlan,
    status,
    priceId: entitlementPriceId,
    start: periodStart,
    end: periodEnd,
  })
  await tx.user.update({
    where: { id: user.id },
    data: {
      stripeCustomerId: subscription.customer as string,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceIds[0] ?? null,
      stripeCurrentPeriodStart: periodStart,
      stripeCurrentPeriodEnd: periodEnd,
      subscriptionStatus: status,
      licensedSiteQuantity: effectivePlan === 'FREE' ? 0 : siteQuantity,
      stripeSubscriptionEventAt: eventOccurredAt,
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
    siteQuantity: effectivePlan === 'FREE' ? 0 : siteQuantity,
    stale: false,
  }
}

async function applyWaitlistConversion(
  tx: Prisma.TransactionClient,
  result: Awaited<ReturnType<typeof processSubscription>>
): Promise<void> {
  if (result.stale || !hasPaidEntitlement(result.status)) return
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
      siteQuantity: result.siteQuantity,
      stale: result.stale,
      occurredAt: new Date(event.created * 1000),
    },
  })
  if (!result.stale) await recordBillingSubscriptionSnapshot(tx, subscription, result.userId, new Date(event.created * 1000), 'WEBHOOK')
}

/** A provider read is recorded as reconciliation, never as an invented webhook. */
export async function syncSubscriptionFromProvider(subscription: Stripe.Subscription, operationId: string) {
  return prisma.$transaction(async tx => {
    const observedAt = new Date()
    const result = await processSubscription(tx, subscription, observedAt)
    if (!result.stale) await recordBillingSubscriptionSnapshot(tx, subscription, result.userId, observedAt, 'ADMIN_RECONCILIATION')
    return { userId: result.userId, plan: result.plan, status: result.status, operationId }
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
  invoice: Stripe.Invoice,
  eventOccurredAt: Date
): Promise<{
  subscription: Stripe.Subscription
  result: Awaited<ReturnType<typeof processSubscription>>
} | null> {
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) return null
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId)
  const result = await processSubscription(tx, subscription, eventOccurredAt)
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

  const completeRefunds:Stripe.Refund[]=[]
  if(event.type==='charge.refunded'){
    const charge=event.data.object
    completeRefunds.push(...(charge.refunds?.data??[]))
    if(charge.refunds?.has_more){let cursor=completeRefunds.at(-1)?.id
      while(cursor){const page=await getStripe().refunds.list({charge:charge.id,limit:100,starting_after:cursor},{timeout:15000,maxNetworkRetries:0});completeRefunds.push(...page.data);if(!page.has_more)break;cursor=page.data.at(-1)?.id}
    }
  }
  await prisma.$transaction(async (tx) => {
    const eventOccurredAt = new Date(event.created * 1000)
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
        const result = await processSubscription(tx, subscription, eventOccurredAt)
        await applyWaitlistConversion(tx, result)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_CREATED', subscription, result)
        break
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const result = await processSubscription(tx, subscription, eventOccurredAt)
        await applyWaitlistConversion(tx, result)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_UPDATED', subscription, result)
        break
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const result = await processSubscription(tx, subscription, eventOccurredAt)
        await recordSubscriptionLifecycle(tx, event, 'SUBSCRIPTION_DELETED', subscription, result)
        break
      }
      case 'invoice.payment_failed': {
        const synced = await syncSubscriptionFromInvoice(tx, event.data.object, eventOccurredAt)
        if (synced) {
          await recordSubscriptionLifecycle(
            tx,
            event,
            'PAYMENT_FAILED',
            synced.subscription,
            synced.result
          )
          if (!synced.result.stale) paymentFailedBox.current = {
            userId: synced.result.userId,
            email: synced.result.email,
            subscriptionId: synced.subscription.id,
          }
        }
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const synced = await syncSubscriptionFromInvoice(tx, event.data.object, eventOccurredAt)
        await recordPaidInvoice(tx,event.data.object,synced?.result.userId??null,eventOccurredAt)
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
        const paymentReference = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        const payment = paymentReference ? await tx.billingLedgerEntry.findFirst({ where: { paymentReference, kind: { not: 'REFUND' } } }) : null
        for (const refund of completeRefunds) {
          await recordProviderRefund(tx, refund, { userId: payment?.userId ?? null, customerId: typeof charge.customer === 'string' ? charge.customer : charge.customer?.id ?? null,
            subscriptionId: payment?.subscriptionId, planAtPayment: payment?.planAtPayment },eventOccurredAt)
        }
        if (typeof charge.payment_intent === 'string') {
          await refundPurchasedCredit(tx, charge.payment_intent,{refundedMinor:completeRefunds.filter(r=>r.status==='succeeded').reduce((sum,r)=>sum+r.amount,0),paidMinor:charge.amount})
        }
        break
      }
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed': {
        const refund=event.data.object,paymentReference=typeof refund.payment_intent==='string'?refund.payment_intent:refund.payment_intent?.id
        const payment=paymentReference?await tx.billingLedgerEntry.findFirst({where:{paymentReference,kind:{not:'REFUND'}}}):null
        await recordProviderRefund(tx,refund,{userId:payment?.userId??null,customerId:payment?.customerId??null,subscriptionId:payment?.subscriptionId,planAtPayment:payment?.planAtPayment},eventOccurredAt)
        const operationId=refund.metadata?.adminOperationId
        const confirmed=refund.status==='succeeded',failed=refund.status==='failed'||refund.status==='canceled'
        if(operationId&&(confirmed||failed)){
          const operation=await tx.adminOperation.findFirst({where:{id:operationId,action:'BILLING_REFUND',status:{in:['RUNNING','INDETERMINATE']}}})
          if(operation){const changed=await tx.adminOperation.updateMany({where:{id:operation.id,status:{in:['RUNNING','INDETERMINATE']}},data:{status:confirmed?'SUCCEEDED':'FAILED',providerReference:refund.id,result:{refundId:refund.id,state:refund.status!,amountMinor:refund.amount,currency:refund.currency},errorCode:failed?'PROVIDER_REFUND_FAILED':null,errorMessage:failed?'The provider confirmed that this refund failed.':null,completedAt:new Date(),executionToken:null,leaseUntil:null}})
          if(changed.count)await appendAdminActivity(tx,operation,'PROVIDER_OUTCOME_CONFIRMED',{providerId:refund.id,state:refund.status,eventId:event.id})}
        }
        break
      }
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.metadata?.type === 'credit_pack') {
          const existingPurchase = await tx.creditPurchase.findUnique({
            where: { stripeSessionId: session.id },
          })
          if(session.payment_status !== 'paid') break
          if (existingPurchase && existingPurchase.status === 'PAID') break
          if (existingPurchase) {
            const paymentReference=typeof session.payment_intent==='string'?session.payment_intent:session.payment_intent?.id
            if(paymentReference)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixflags:payment-receipt:${paymentReference}`}))`
            const priorPayment=paymentReference?await tx.billingLedgerEntry.findFirst({where:{paymentReference,kind:{not:'REFUND'}}}):null
            if(!priorPayment && session.amount_total !== null && session.currency && paymentReference) await tx.billingLedgerEntry.upsert({where:{kind_providerId:{kind:'CREDIT_PAYMENT',providerId:session.id}},create:{providerId:session.id,kind:'CREDIT_PAYMENT',userId:existingPurchase.userId,customerId:typeof session.customer==='string'?session.customer:session.customer?.id,paymentReference,amountMinor:session.amount_total,currency:session.currency,status:'SUCCEEDED',occurredAt:eventOccurredAt},update:{}})
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
