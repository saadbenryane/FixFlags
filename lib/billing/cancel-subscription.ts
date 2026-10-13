import type Stripe from 'stripe'
/** A schedule owns its attached subscription. Cancel through that owner and verify the final subscription. */
export async function cancelProviderSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
  idempotencyKey: string,
) {
  const options = { idempotencyKey, timeout: 15000, maxNetworkRetries: 0 }
  if (subscription.status === 'canceled') return subscription
  if (subscription.schedule) {
    await stripe.subscriptionSchedules.cancel(
      typeof subscription.schedule === 'string' ? subscription.schedule : subscription.schedule.id,
      { invoice_now: false, prorate: false },
      options,
    )
    return stripe.subscriptions.retrieve(
      subscription.id,
      {},
      { timeout: 15000, maxNetworkRetries: 0 },
    )
  }
  return stripe.subscriptions.cancel(
    subscription.id,
    { invoice_now: false, prorate: false },
    options,
  )
}
