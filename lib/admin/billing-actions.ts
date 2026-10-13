import { importProviderBillingHistory } from '@/lib/billing/provider-history'
import { cancelProviderSubscription } from '@/lib/billing/cancel-subscription'
import { subscriptionPhaseSettings, subscriptionPhaseItems } from './subscription-phase'
import type { AdminOperation, Prisma } from '@prisma/client'
import type Stripe from 'stripe'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { STRIPE_PRICE_IDS, planFromPriceId } from '@/lib/billing/plans'
import { formatMoneyMinor, recordProviderRefund } from '@/lib/billing/ledger'
import { syncSubscriptionFromProvider } from '@/lib/billing/stripe-webhook'
import { AdminActionError, AdminOutcomeUnknown } from './errors'
import { revisionHash } from './security'
import type { AdminActionRequest } from './contracts'

const providerRead = { timeout: 15_000, maxNetworkRetries: 0 }

function billingClient() {
  try {
    return getStripe()
  } catch {
    throw new AdminActionError(
      'Stripe is not configured. No billing change was made.',
      503,
      'BILLING_UNAVAILABLE',
    )
  }
}
function subscriptionBoundary(subscription: Stripe.Subscription) {
  const end = (subscription as unknown as { current_period_end?: number }).current_period_end
  if (!end)
    throw new AdminActionError(
      'The provider has not supplied a billing boundary.',
      409,
      'BILLING_BOUNDARY_UNAVAILABLE',
    )
  return end
}
function subscriptionIdentity(subscription: Stripe.Subscription) {
  return subscription
}

export async function previewAdminBillingAction(request: AdminActionRequest) {
  const stripe = billingClient(),
    input = request.input
  if (request.action === 'BILLING_REFUND') {
    const payment = await prisma.billingLedgerEntry.findUniqueOrThrow({
      where: { id: request.targetId },
    })
    if (!payment.paymentReference)
      throw new AdminActionError(
        'The provider payment reference is missing.',
        409,
        'PAYMENT_REFERENCE_MISSING',
      )
    const intent = await stripe.paymentIntents.retrieve(
      payment.paymentReference,
      { expand: ['latest_charge'] },
      providerRead,
    )
    const charge = intent.latest_charge
    if (!charge || typeof charge === 'string')
      throw new AdminActionError(
        'The payment has no confirmed charge.',
        409,
        'PAYMENT_NOT_REFUNDABLE',
      )
    if (intent.status !== 'succeeded' || !charge.paid || !charge.captured)
      throw new AdminActionError('The provider payment is not settled.', 409, 'PAYMENT_NOT_SETTLED')
    const customerId = typeof intent.customer === 'string' ? intent.customer : intent.customer?.id
    if (
      (payment.customerId && customerId !== payment.customerId) ||
      charge.currency !== payment.currency
    )
      throw new AdminActionError(
        'The provider payment identity differs from the ledger. Reconcile it first.',
        409,
        'PAYMENT_IDENTITY_CHANGED',
      )
    const remaining = charge.amount - charge.amount_refunded
    const amount = input.amountMinor as number
    if (amount <= 0 || amount > remaining)
      throw new AdminActionError(
        'The provider refund balance changed. Reconcile the payment before confirming.',
        409,
        'REFUND_BALANCE_CHANGED',
      )
    return {
      revision: revisionHash({
        id: intent.id,
        status: intent.status,
        chargeId: charge.id,
        amount: charge.amount,
        refunded: charge.amount_refunded,
        currency: charge.currency,
      }),
      effects: [
        `Refund ${formatMoneyMinor(amount, charge.currency)} of the confirmed payment.`,
        `Provider payment: ${payment.providerId}.`,
        'The subscription remains unchanged.',
      ],
    }
  }
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: request.targetId },
    select: { stripeSubscriptionId: true, stripeCustomerId: true, stripePriceId: true },
  })
  if (!user.stripeSubscriptionId && request.action === 'BILLING_RECONCILE')
    return {
      revision: revisionHash({ customerId: user.stripeCustomerId, subscriptionId: null }),
      effects: [
        'Read this customer’s provider receipts and import their paid invoices, credit payments, and refunds. No payment is taken.',
      ],
    }
  if (!user.stripeSubscriptionId)
    throw new AdminActionError('This account has no provider subscription.', 409, 'NO_SUBSCRIPTION')
  const subscription = await stripe.subscriptions.retrieve(
    user.stripeSubscriptionId,
    {},
    providerRead,
  )
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
  if (
    request.action !== 'BILLING_RECONCILE' &&
    (!user.stripeCustomerId || customerId !== user.stripeCustomerId)
  )
    throw new AdminActionError(
      'Reconcile this account’s provider mapping before changing billing.',
      409,
      'BILLING_MAPPING_UNCONFIRMED',
    )
  const managedSchedule = subscription.schedule
    ? await stripe.subscriptionSchedules.retrieve(
        typeof subscription.schedule === 'string'
          ? subscription.schedule
          : subscription.schedule.id,
        {},
        providerRead,
      )
    : null
  const identity = { subscription: subscriptionIdentity(subscription), schedule: managedSchedule }
  if (
    request.action !== 'BILLING_RECONCILE' &&
    ['canceled', 'incomplete_expired'].includes(subscription.status)
  )
    throw new AdminActionError('This provider subscription has ended.', 409, 'SUBSCRIPTION_ENDED')
  if (request.action === 'BILLING_CHANGE_SUBSCRIPTION') {
    const priceId = STRIPE_PRICE_IDS[input.plan as 'BUILDER' | 'TEAM']
    if (!priceId)
      throw new AdminActionError(
        'The selected subscription price is not configured.',
        503,
        'PRICE_UNAVAILABLE',
      )
    const item = subscription.items.data.find(
      (value) => value.price.id === user.stripePriceId || planFromPriceId(value.price.id),
    )
    if (!item)
      throw new AdminActionError(
        'This subscription has no recognized plan item.',
        409,
        'SUBSCRIPTION_ITEM_UNAVAILABLE',
      )
    if (input.timing === 'immediate') {
      const invoice = await stripe.invoices.createPreview(
        {
          subscription: subscription.id,
          subscription_details: {
            items: [{ id: item.id, price: priceId, quantity: input.quantity as number }],
            proration_date: input.prorationDate as number,
          },
        },
        providerRead,
      )
      return {
        revision: revisionHash({
          ...identity,
          previewAmount: invoice.amount_due,
          currency: invoice.currency,
        }),
        effects: [
          `Change to ${input.plan === 'TEAM' ? 'Studio' : 'Pro'} for ${input.quantity} licensed Sites now. Provider invoice preview: ${formatMoneyMinor(invoice.amount_due, invoice.currency)} due.`,
          ...(managedSchedule
            ? [
                'Release the existing schedule and its future phases. Preserve any existing cancellation date.',
              ]
            : []),
          'The final provider outcome is recorded separately from this preview.',
        ],
      }
    }
    const end = subscriptionBoundary(subscription)
    const schedule = subscription.schedule
      ? await stripe.subscriptionSchedules.retrieve(
          typeof subscription.schedule === 'string'
            ? subscription.schedule
            : subscription.schedule.id,
          {},
          providerRead,
        )
      : null
    return {
      revision: revisionHash({ ...identity, phases: schedule?.phases }),
      effects: [
        `Apply ${input.plan === 'TEAM' ? 'Studio' : 'Pro'} for ${input.quantity} licensed Sites at ${new Date(end * 1000).toISOString()}.`,
        schedule
          ? 'Replace the scheduled future plan phases with this confirmed change.'
          : 'Preserve the current subscription until that billing boundary.',
      ],
    }
  }
  return {
    revision: revisionHash(identity),
    effects:
      request.action === 'BILLING_CANCEL_SUBSCRIPTION'
        ? [
            input.timing === 'immediate'
              ? 'End this subscription immediately.'
              : `End this subscription at ${new Date(subscriptionBoundary(subscription) * 1000).toISOString()}.`,
            ...(managedSchedule
              ? ['Replace future schedule phases with cancellation at the current period boundary.']
              : []),
            'No refund is requested.',
          ]
        : [
            request.action === 'BILLING_RECONCILE'
              ? 'Read current provider state and reconcile the account.'
              : 'Remove the scheduled cancellation and keep the subscription active.',
          ],
  }
}

export async function performAdminBillingAction(
  operation: AdminOperation,
  input: Record<string, unknown>,
): Promise<Prisma.InputJsonObject> {
  const stripe = billingClient()
  const request = {
    action: operation.action,
    targetId: operation.targetId,
    reason: operation.reason,
    input,
  } as AdminActionRequest
  const current = await previewAdminBillingAction(request)
  if (!operation.providerRevision || current.revision !== operation.providerRevision)
    throw new AdminActionError(
      'Provider billing state changed. Review a new confirmation.',
      409,
      'PROVIDER_STATE_CHANGED',
    )
  const options = { ...providerRead, idempotencyKey: `admin-${operation.id}` }
  if (operation.action === 'BILLING_RECONCILE') {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: operation.targetId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    })
    if (user.stripeSubscriptionId)
      await syncSubscriptionFromProvider(
        await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {}, providerRead),
        operation.id,
      )
    const synchronized = await prisma.user.findUniqueOrThrow({
      where: { id: operation.targetId },
      select: { stripeCustomerId: true },
    })
    const history = await importProviderBillingHistory(
      stripe,
      operation.targetId,
      synchronized.stripeCustomerId,
      operation.createdAt,
    )
    return { state: 'RECONCILED', historyImported: true, ...history }
  }
  try {
    if (operation.action === 'BILLING_REFUND') {
      const payment = await prisma.billingLedgerEntry.findUniqueOrThrow({
        where: { id: operation.targetId },
      })
      const refund = await stripe.refunds.create(
        {
          payment_intent: payment.paymentReference!,
          amount: input.amountMinor as number,
          metadata: { adminOperationId: operation.id },
        },
        options,
      )
      await prisma.adminOperation.updateMany({
        where: { id: operation.id, status: 'RUNNING', executionToken: operation.executionToken },
        data: { providerReference: refund.id },
      })
      await prisma.$transaction((tx) =>
        recordProviderRefund(tx, refund, {
          userId: payment.userId,
          customerId: payment.customerId,
          subscriptionId: payment.subscriptionId,
          planAtPayment: payment.planAtPayment,
        }),
      )
      if (refund.status === 'failed' || refund.status === 'canceled')
        throw new AdminActionError(
          'The provider confirmed that the refund failed.',
          502,
          'PROVIDER_REFUND_FAILED',
        )
      if (refund.status !== 'succeeded')
        throw new AdminOutcomeUnknown(
          `Refund ${refund.id} has not reached a confirmed success state.`,
        )
      return {
        refundId: refund.id,
        amountMinor: refund.amount,
        currency: refund.currency,
        state: 'REFUNDED',
      }
    }
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: operation.targetId },
      select: { stripeSubscriptionId: true, stripePriceId: true },
    })
    let subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(
      user.stripeSubscriptionId!,
      {},
      providerRead,
    )
    switch (operation.action) {
      case 'BILLING_CANCEL_SUBSCRIPTION':
        if (input.timing === 'immediate')
          subscription = await cancelProviderSubscription(
            stripe,
            subscription,
            options.idempotencyKey,
          )
        else if (subscription.schedule) {
          const schedule = await stripe.subscriptionSchedules.retrieve(
            typeof subscription.schedule === 'string'
              ? subscription.schedule
              : subscription.schedule.id,
            {},
            providerRead,
          )
          const current = schedule.phases.find(
            (p) => p.start_date === schedule.current_phase?.start_date,
          )
          if (!current || !schedule.current_phase)
            throw new AdminActionError(
              'The current schedule phase is unavailable.',
              409,
              'SCHEDULE_UNAVAILABLE',
            )
          await stripe.subscriptionSchedules.update(
            schedule.id,
            {
              end_behavior: 'cancel',
              phases: [
                {
                  ...subscriptionPhaseSettings(current),
                  start_date: schedule.current_phase.start_date,
                  end_date: subscriptionBoundary(subscription),
                  items: subscriptionPhaseItems(current),
                  proration_behavior: 'none',
                },
              ],
            },
            options,
          )
          return {
            subscriptionId: subscription.id,
            scheduleId: schedule.id,
            state: 'CANCELLATION_SCHEDULED',
            effectiveAt: new Date(subscriptionBoundary(subscription) * 1000).toISOString(),
          }
        } else
          subscription = await stripe.subscriptions.update(
            subscription.id,
            { cancel_at_period_end: true },
            options,
          )
        break
      case 'BILLING_RESUME_SUBSCRIPTION':
        if (subscription.schedule) {
          await stripe.subscriptionSchedules.update(
            typeof subscription.schedule === 'string'
              ? subscription.schedule
              : subscription.schedule.id,
            { end_behavior: 'release' },
            options,
          )
          subscription = await stripe.subscriptions.retrieve(subscription.id, {}, providerRead)
        } else
          subscription = await stripe.subscriptions.update(
            subscription.id,
            { cancel_at_period_end: false },
            options,
          )
        break
      case 'BILLING_CHANGE_SUBSCRIPTION': {
        const item = subscription.items.data.find(
          (value) => value.price.id === user.stripePriceId || planFromPriceId(value.price.id),
        )!
        const price = STRIPE_PRICE_IDS[input.plan as 'BUILDER' | 'TEAM']!
        if (input.timing === 'immediate') {
          if (subscription.schedule)
            await stripe.subscriptionSchedules.release(
              typeof subscription.schedule === 'string'
                ? subscription.schedule
                : subscription.schedule.id,
              { preserve_cancel_date: true },
              { ...options, idempotencyKey: `${options.idempotencyKey}-release` },
            )
          subscription = await stripe.subscriptions.update(
            subscription.id,
            {
              items: [{ id: item.id, price, quantity: input.quantity as number }],
              proration_behavior: 'create_prorations',
              proration_date: input.prorationDate as number,
            },
            options,
          )
        } else {
          const schedule = subscription.schedule
            ? await stripe.subscriptionSchedules.retrieve(
                typeof subscription.schedule === 'string'
                  ? subscription.schedule
                  : subscription.schedule.id,
                {},
                providerRead,
              )
            : await stripe.subscriptionSchedules.create(
                { from_subscription: subscription.id },
                { ...options, idempotencyKey: `${options.idempotencyKey}-schedule` },
              )
          if (!schedule.current_phase)
            throw new AdminActionError(
              'The subscription schedule has no current phase.',
              409,
              'SCHEDULE_UNAVAILABLE',
            )
          const boundary = subscriptionBoundary(subscription)
          const currentPhase = schedule.phases.find(
            (phase) => phase.start_date === schedule.current_phase!.start_date,
          )
          if (!currentPhase)
            throw new AdminActionError(
              'The current phase’s financial settings are unavailable.',
              409,
              'SCHEDULE_UNAVAILABLE',
            )
          const settings = subscriptionPhaseSettings(currentPhase)
          const items = subscriptionPhaseItems(currentPhase)
          const nextItems = items.map((value) => ({
            ...value,
            ...(value.price === item.price.id ? { price, quantity: input.quantity as number } : {}),
          }))
          await stripe.subscriptionSchedules.update(
            schedule.id,
            {
              end_behavior: 'release',
              phases: [
                {
                  ...settings,
                  start_date: schedule.current_phase.start_date,
                  end_date: boundary,
                  items,
                  ...(currentPhase?.trial_end &&
                  currentPhase.trial_end > Math.floor(Date.now() / 1000)
                    ? { trial_end: currentPhase.trial_end }
                    : {}),
                  proration_behavior: 'none',
                },
                { ...settings, start_date: boundary, items: nextItems, proration_behavior: 'none' },
              ],
            },
            { ...options, idempotencyKey: `${options.idempotencyKey}-phases` },
          )
          return {
            subscriptionId: subscription.id,
            scheduleId: schedule.id,
            state: 'SCHEDULED',
            effectiveAt: new Date(boundary * 1000).toISOString(),
          }
        }
        break
      }
      case 'BILLING_RECONCILE':
        break
      default:
        throw new AdminActionError('Unknown billing action.', 400, 'INVALID_ACTION')
    }
    await syncSubscriptionFromProvider(subscription, operation.id)
    return {
      subscriptionId: subscription.id,
      state: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    }
  } catch (error) {
    if (error instanceof AdminActionError) throw error
    if (error instanceof Error && /connection|timeout|network|ECONN|ETIMEDOUT/i.test(error.message))
      throw new AdminOutcomeUnknown(
        'The provider outcome could not be confirmed. Reconciliation is required before another request.',
      )
    throw error
  }
}
