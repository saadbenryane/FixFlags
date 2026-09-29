/**
 * Watch alert delivery policy.
 *
 * Delivery is a separate fact from coverage. A Site can be checked on schedule
 * and still never tell the customer anything, so the two must not collapse into
 * one healthy-looking state. This module is deliberately dependency-free so both
 * the sender and the customer-facing view can read the same policy, rather than
 * one re-deriving the other's rules.
 */

/** A permanently failing alert must not retry forever, so delivery is bounded. */
export const WATCH_NOTIFICATION_ATTEMPT_LIMIT = 5

export type WatchNotificationStatusLike =
  | 'NOT_APPLICABLE'
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'

/**
 * `none`         No alert was warranted, so there is nothing to report.
 * `delivering`   An alert is warranted and FixFlags is still getting it out.
 * `delivered`    The customer was told.
 * `undelivered`  FixFlags stopped trying. The customer was never told.
 */
export type WatchAlertDeliveryState = 'none' | 'delivering' | 'delivered' | 'undelivered'

/**
 * What can honestly be said about the most recent alert.
 *
 * A failure that is still being retried is deliberately not terminal. Reporting
 * it early would be a false alarm, and the bounded retry exists precisely so
 * FixFlags keeps trying before it admits that it could not reach the customer.
 */
export function watchAlertDelivery(input: {
  status: WatchNotificationStatusLike | null | undefined
  attempts: number
}): WatchAlertDeliveryState {
  const status = input.status
  if (!status || status === 'NOT_APPLICABLE') return 'none'
  if (status === 'SENT') return 'delivered'
  if (status === 'PENDING' || status === 'SENDING') return 'delivering'
  // FAILED. Terminal only once the retries are genuinely spent.
  return input.attempts >= WATCH_NOTIFICATION_ATTEMPT_LIMIT ? 'undelivered' : 'delivering'
}
