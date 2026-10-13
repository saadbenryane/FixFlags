import { importProviderBillingHistory } from '@/lib/billing/provider-history'
import { isDatabaseAdminAction } from './database-actions'
import type Stripe from 'stripe'
import type { AdminOperation, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { STRIPE_PRICE_IDS } from '@/lib/billing/plans'
import { recordProviderRefund } from '@/lib/billing/ledger'
import { syncSubscriptionFromProvider } from '@/lib/billing/stripe-webhook'
import { appendAdminActivity } from './activity'
import { AdminActionError } from './errors'
export async function reconcileAdminOutcome(
  command: AdminOperation,
): Promise<Prisma.InputJsonObject> {
  const original = await prisma.adminOperation.findUniqueOrThrow({
      where: { id: command.targetId },
    }),
    input = original.input as Record<string, unknown>
  if (original.status !== 'INDETERMINATE')
    throw new AdminActionError('This outcome was already reconciled.', 409, 'OUTCOME_CHANGED')
  let status: 'SUCCEEDED' | 'FAILED' | undefined,
    result: Prisma.InputJsonObject = { state: 'UNCONFIRMED' }
  if (isDatabaseAdminAction(original.action)) {
    status = 'FAILED'
    result = {
      state: 'NOT_ATOMICALLY_COMPLETED',
      message: 'The interrupted database action did not commit. Review a new action.',
    }
  } else if (original.action === 'BILLING_REFUND') {
    const payment = await prisma.billingLedgerEntry.findUniqueOrThrow({
        where: { id: original.targetId },
      }),
      stripe = getStripe()
    let refund: Stripe.Refund | undefined
    if (original.providerReference)
      refund = await stripe.refunds.retrieve(
        original.providerReference,
        {},
        { timeout: 15000, maxNetworkRetries: 0 },
      )
    else {
      let cursor: string | undefined
      do {
        const page = await stripe.refunds.list(
          {
            payment_intent: payment.paymentReference!,
            limit: 100,
            ...(cursor ? { starting_after: cursor } : {}),
          },
          { timeout: 15000, maxNetworkRetries: 0 },
        )
        refund = page.data.find((r) => r.metadata?.adminOperationId === original.id)
        if (refund || !page.has_more) break
        cursor = page.data.at(-1)?.id
      } while (cursor)
    }
    if (refund) {
      await prisma.$transaction((tx) =>
        recordProviderRefund(tx, refund, {
          userId: payment.userId,
          customerId: payment.customerId,
          subscriptionId: payment.subscriptionId,
          planAtPayment: payment.planAtPayment,
        }),
      )
      status =
        refund.status === 'succeeded'
          ? 'SUCCEEDED'
          : refund.status === 'failed' || refund.status === 'canceled'
            ? 'FAILED'
            : undefined
      result = {
        refundId: refund.id,
        state: refund.status ?? 'pending',
        amountMinor: refund.amount,
        currency: refund.currency,
      }
    }
  } else if (original.action === 'BILLING_RECONCILE') {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: original.targetId },
        select: { stripeSubscriptionId: true, stripeCustomerId: true },
      }),
      stripe = getStripe()
    if (user.stripeSubscriptionId)
      await syncSubscriptionFromProvider(
        await stripe.subscriptions.retrieve(
          user.stripeSubscriptionId,
          {},
          { timeout: 15000, maxNetworkRetries: 0 },
        ),
        command.id,
      )
    const history = await importProviderBillingHistory(
      stripe,
      original.targetId,
      user.stripeCustomerId,
      original.createdAt,
    )
    status = 'SUCCEEDED'
    result = { state: 'RECONCILED', historyImported: true, ...history }
  } else if (original.action.startsWith('BILLING_')) {
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: original.targetId },
        select: { stripeSubscriptionId: true },
      }),
      stripe = getStripe()
    if (!user.stripeSubscriptionId)
      throw new AdminActionError(
        'The subscription reference is unavailable.',
        409,
        'NO_SUBSCRIPTION',
      )
    const subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
      {},
      { timeout: 15000, maxNetworkRetries: 0 },
    )
    await syncSubscriptionFromProvider(subscription, command.id)
    let proven =
      original.action === 'BILLING_RECONCILE' ||
      (original.action === 'BILLING_CANCEL_SUBSCRIPTION' &&
        (input.timing === 'immediate'
          ? subscription.status === 'canceled'
          : subscription.cancel_at_period_end)) ||
      (original.action === 'BILLING_RESUME_SUBSCRIPTION' &&
        !subscription.cancel_at_period_end &&
        subscription.status !== 'canceled')
    if (original.action === 'BILLING_CHANGE_SUBSCRIPTION') {
      const price = STRIPE_PRICE_IDS[input.plan as 'BUILDER' | 'TEAM']
      if (input.timing === 'immediate')
        proven = subscription.items.data.some(
          (i) => i.price.id === price && i.quantity === input.quantity,
        )
      else if (subscription.schedule) {
        const schedule = await stripe.subscriptionSchedules.retrieve(
          typeof subscription.schedule === 'string'
            ? subscription.schedule
            : subscription.schedule.id,
          {},
          { timeout: 15000, maxNetworkRetries: 0 },
        )
        proven = schedule.phases.some(
          (p) =>
            p.start_date >= (schedule.current_phase?.end_date ?? Infinity) &&
            p.items.some(
              (i) =>
                (typeof i.price === 'string' ? i.price : i.price.id) === price &&
                i.quantity === input.quantity,
            ),
        )
      }
    }
    if (proven) {
      status = 'SUCCEEDED'
      result = { subscriptionId: subscription.id, state: subscription.status, reconciled: true }
    }
  } else if (
    ['SITE_CHECK', 'AUDIT_RETRY', 'SITE_ACCOUNT_RECONCILE', 'SITE_ACCOUNT_CLEANUP'].includes(
      original.action,
    )
  ) {
    const run = await prisma.runRequest.findFirst({
      where: { context: { path: ['adminOperationId'], equals: original.id } },
      select: { id: true, auditId: true, status: true },
    })
    if (run) {
      status = 'SUCCEEDED'
      result = {
        runId: run.id,
        auditId: run.auditId,
        state: 'ADMITTED',
        executionState: run.status,
      }
    }
  } else if (original.action === 'WATCH_NOTIFICATION_RETRY') {
    const receipt = await prisma.audit.findUnique({
      where: { id: original.targetId },
      select: { watchNotificationStatus: true, watchNotificationProviderId: true },
    })
    if (
      receipt &&
      ['SENT', 'SUPPRESSED', 'NOT_APPLICABLE'].includes(receipt.watchNotificationStatus)
    ) {
      status = 'SUCCEEDED'
      result = {
        state: receipt.watchNotificationStatus,
        providerId: receipt.watchNotificationProviderId,
      }
    }
  } else if (original.action === 'UPTIME_NOTIFICATION_RETRY') {
    const receipt = await prisma.uptimeNotification.findUnique({
      where: { id: original.targetId },
      select: { status: true, providerId: true },
    })
    if (receipt && ['SENT', 'SKIPPED'].includes(receipt.status)) {
      status = 'SUCCEEDED'
      result = { state: receipt.status, providerId: receipt.providerId }
    }
  } else if (original.action === 'USER_REMOVE') {
    const exists = await prisma.user.findUnique({
      where: { id: original.targetId },
      select: { id: true },
    })
    if (!exists) {
      status = 'SUCCEEDED'
      result = { state: 'ERASED' }
    }
  }
  await prisma.$transaction(async (tx) => {
    if (status) {
      const changed = await tx.adminOperation.updateMany({
        where: { id: original.id, status: 'INDETERMINATE' },
        data: { status, result, errorCode: null, errorMessage: null, completedAt: new Date() },
      })
      if (changed.count)
        await appendAdminActivity(tx, original, 'OUTCOME_RECONCILED', {
          reconciledBy: command.actorId,
          reconciliationId: command.id,
          ...result,
        })
    } else
      await appendAdminActivity(tx, original, 'RECONCILIATION_INCONCLUSIVE', {
        reconciledBy: command.actorId,
        reconciliationId: command.id,
      })
  })
  return { operationId: original.id, outcome: status ?? 'INDETERMINATE', ...result }
}
