import type Stripe from 'stripe'
import type { Plan, Prisma } from '@prisma/client'
import { planFromPriceId } from './plans'

export function currencyMinorDigits(currency: string) {
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits
  if (digits === undefined) throw new Error('Currency precision is not available')
  return digits
}

export function formatMoneyMinor(amount: number, currency: string) {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(amount / 10 ** currencyMinorDigits(currency))
}

export async function recordBillingSubscriptionSnapshot(
  tx: Prisma.TransactionClient,
  subscription: Stripe.Subscription,
  userId: string,
  observedAt: Date,
  source: 'WEBHOOK' | 'ADMIN_RECONCILIATION',
) {
  const items = subscription.items.data.map((item) => ({
    priceId: item.price.id,
    amountMinor: item.price.unit_amount,
    currency: item.price.currency,
    quantity: item.quantity ?? 1,
    interval: item.price.recurring?.interval ?? null,
    intervalCount: item.price.recurring?.interval_count ?? null,
    plan: planFromPriceId(item.price.id),
  }))
  const existing = await tx.billingSubscriptionSnapshot.findUnique({
    where: { subscriptionId: subscription.id },
    select: { observedAt: true },
  })
  if (existing && existing.observedAt > observedAt) return
  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
  const data = {
    userId,
    customerId:
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
    scheduleId:
      typeof subscription.schedule === 'string'
        ? subscription.schedule
        : (subscription.schedule?.id ?? null),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    items,
    observedAt,
    source,
  }
  await tx.billingSubscriptionSnapshot.upsert({
    where: { subscriptionId: subscription.id },
    create: { subscriptionId: subscription.id, ...data },
    update: data,
  })
}

export async function recordPaidInvoice(
  tx: Prisma.TransactionClient,
  invoice: Stripe.Invoice,
  userId: string | null,
  observedAt: Date,
) {
  const subscription =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : (invoice.subscription?.id ?? null)
  const price = invoice.lines.data.find(
    (line) => line.price && planFromPriceId(line.price.id),
  )?.price
  const paymentReference =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : (invoice.payment_intent?.id ?? null)
  if (paymentReference) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixflags:payment-receipt:${paymentReference}`}))`
    const existing = await tx.billingLedgerEntry.findFirst({
      where: { paymentReference, kind: { not: 'REFUND' } },
    })
    if (existing && existing.kind !== 'INVOICE_PAYMENT') return
  }
  const data = {
    userId,
    customerId:
      typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer?.id ?? null),
    subscriptionId: subscription,
    paymentReference,
    planAtPayment: price ? planFromPriceId(price.id) : null,
    amountMinor: invoice.amount_paid,
    currency: invoice.currency,
    status: 'SUCCEEDED',
    recurring: Boolean(subscription),
    occurredAt: invoice.status_transitions.paid_at
      ? new Date(invoice.status_transitions.paid_at * 1000)
      : observedAt,
  }
  await tx.billingLedgerEntry.upsert({
    where: { kind_providerId: { kind: 'INVOICE_PAYMENT', providerId: invoice.id } },
    create: { kind: 'INVOICE_PAYMENT', providerId: invoice.id, ...data },
    update: data,
  })
}

export async function recordProviderRefund(
  tx: Prisma.TransactionClient,
  refund: Stripe.Refund,
  input: {
    userId: string | null
    customerId: string | null
    subscriptionId?: string | null
    planAtPayment?: Plan | null
  },
  observedAt = new Date(),
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fixflags:refund-receipt:${refund.id}`}))`
  const existing = await tx.billingLedgerEntry.findUnique({
    where: { kind_providerId: { kind: 'REFUND', providerId: refund.id } },
    select: { recordedAt: true },
  })
  if (existing && existing.recordedAt > observedAt) return
  const paymentReference =
    typeof refund.payment_intent === 'string'
      ? refund.payment_intent
      : (refund.payment_intent?.id ?? null)
  const status =
    refund.status === 'succeeded'
      ? 'SUCCEEDED'
      : refund.status === 'failed' || refund.status === 'canceled'
        ? 'FAILED'
        : 'PENDING'
  const data = {
    ...input,
    paymentReference,
    amountMinor: refund.amount,
    currency: refund.currency,
    status,
    recordedAt: observedAt,
    recurring: false,
    occurredAt: new Date(refund.created * 1000),
  }
  await tx.billingLedgerEntry.upsert({
    where: { kind_providerId: { kind: 'REFUND', providerId: refund.id } },
    create: { kind: 'REFUND', providerId: refund.id, ...data },
    update: data,
  })
}
