import type Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { recordPaidInvoice, recordProviderRefund } from './ledger'
/** Read provider receipts in pages. Nothing is charged, canceled, or refunded by reconciliation. */
export async function importProviderBillingHistory(
  stripe: Stripe,
  userId: string,
  customerId: string | null,
  asOf: Date,
) {
  const read = { timeout: 15000, maxNetworkRetries: 0 },
    cutoff = Math.floor(asOf.getTime() / 1000)
  let invoices = 0,
    creditPayments = 0,
    refunds = 0
  async function refundReceipts(paymentReference: string) {
    let cursor: string | undefined
    do {
      const page = await stripe.refunds.list(
        {
          payment_intent: paymentReference,
          limit: 100,
          ...(cursor ? { starting_after: cursor } : {}),
        },
        read,
      )
      for (const refund of page.data) {
        await prisma.$transaction((tx) => recordProviderRefund(tx, refund, { userId, customerId }))
        refunds++
      }
      if (!page.has_more) break
      cursor = page.data.at(-1)?.id
    } while (cursor)
  }
  if (customerId) {
    let cursor: string | undefined
    do {
      const page = await stripe.invoices.list(
        {
          customer: customerId,
          status: 'paid',
          created: { lte: cutoff },
          limit: 100,
          ...(cursor ? { starting_after: cursor } : {}),
        },
        read,
      )
      for (const invoice of page.data) {
        await prisma.$transaction((tx) => recordPaidInvoice(tx, invoice, userId, asOf))
        invoices++
        const reference =
          typeof invoice.payment_intent === 'string'
            ? invoice.payment_intent
            : invoice.payment_intent?.id
        if (reference) await refundReceipts(reference)
      }
      if (!page.has_more) break
      cursor = page.data.at(-1)?.id
    } while (cursor)
  }
  let purchaseCursor: string | undefined
  do {
    const purchases = await prisma.creditPurchase.findMany({
      where: { userId, status: { in: ['PAID', 'REFUNDED'] }, stripePaymentIntentId: { not: null } },
      orderBy: { id: 'asc' },
      take: 100,
      ...(purchaseCursor ? { cursor: { id: purchaseCursor }, skip: 1 } : {}),
    })
    for (const purchase of purchases) {
      const intent = await stripe.paymentIntents.retrieve(purchase.stripePaymentIntentId!, {}, read)
      if (intent.status !== 'succeeded') continue
      const actualCustomer =
        typeof intent.customer === 'string' ? intent.customer : (intent.customer?.id ?? null)
      if (customerId && actualCustomer && actualCustomer !== customerId)
        throw new Error('Provider credit payment belongs to another customer.')
      const already = await prisma.billingLedgerEntry.findFirst({
        where: { paymentReference: intent.id, kind: { not: 'REFUND' } },
      })
      if (!already)
        await prisma.billingLedgerEntry.upsert({
          where: { kind_providerId: { kind: 'CREDIT_PAYMENT', providerId: intent.id } },
          create: {
            kind: 'CREDIT_PAYMENT',
            providerId: intent.id,
            userId,
            customerId: actualCustomer,
            paymentReference: intent.id,
            amountMinor: intent.amount_received,
            currency: intent.currency,
            status: 'SUCCEEDED',
            occurredAt: purchase.paidAt ?? new Date(intent.created * 1000),
          },
          update: {},
        })
      creditPayments++
      await refundReceipts(intent.id)
    }
    if (purchases.length < 100) break
    purchaseCursor = purchases.at(-1)?.id
  } while (purchaseCursor)
  return { invoices, creditPayments, refunds, asOf: asOf.toISOString() }
}
