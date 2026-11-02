export type EmailDeliveryState = 'sending' | 'not_sent' | 'accepted' | 'delayed' | 'delivered' | 'failed' | 'bounced' | 'complained'
export type EmailDeliveryFacts = {
  acceptedAt: Date; delayedAt: Date | null; deliveredAt: Date | null;
  failedAt: Date | null; bouncedAt: Date | null; complainedAt: Date | null;
}

/** Independent dated facts survive out-of-order events. An open pixel is never
 * evidence that a person read the message. */
export function emailDeliveryState(facts: EmailDeliveryFacts): EmailDeliveryState {
  if (facts.complainedAt) return 'complained'
  if (facts.bouncedAt) return 'bounced'
  if (facts.failedAt && (!facts.deliveredAt || facts.failedAt > facts.deliveredAt)) return 'failed'
  if (facts.deliveredAt) return 'delivered'
  if (facts.delayedAt) return 'delayed'
  return 'accepted'
}

export type EmailDeliveryChannel = 'summary' | 'watch' | 'uptime' | 'onboarding'
export type EmailDeliveryView = { id: string; channel: EmailDeliveryChannel; state: EmailDeliveryState; at: string }
