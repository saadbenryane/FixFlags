import { WATCH_ALERT_DELIVERY } from '@/lib/marketing/copy-barrel'
import {
  type WatchAlertDeliveryState,
  type WatchNotificationStatusLike,
} from '@/lib/audit/watch-notification'

/**
 * The customer notice for an alert FixFlags could not deliver.
 *
 * Historical delivery and current monitoring coverage are independent facts.
 * Keep the delivery warning visible even if the schedule has since changed.
 * Views use the current coverage projection when describing continued checks.
 *
 * Only a terminal failure produces a notice. A failure that is still being
 * retried is the system working, and reporting it would be a false alarm.
 */
export type SiteWatchAlertNotice = {
  title: string
  actionLabel: string
  actionHref: string
  at: string | null
}

export function siteWatchAlertNotice(input: {
  state: WatchAlertDeliveryState
  at: Date | string | null
}): SiteWatchAlertNotice | null {
  // The server projection has the alert's saved ceiling and lease. Views must
  // not reinterpret its state using a default attempt limit.
  if (input.state !== 'undelivered') return null
  return {
    title: WATCH_ALERT_DELIVERY.undeliveredTitle,
    actionLabel: WATCH_ALERT_DELIVERY.undeliveredAction,
    // The email on the account is what FixFlags sends to, and it is editable
    // there, so this is a place the customer can actually fix it.
    actionHref: '/settings',
    at: input.at instanceof Date ? input.at.toISOString() : input.at ?? null,
  }
}

/** The absence of delivery evidence. Distinct from a delivery that failed. */
export const NO_ALERT_DELIVERY = {
  state: 'none',
  status: null,
  attempts: 0,
  at: null,
} as const satisfies {
  state: WatchAlertDeliveryState
  status: WatchNotificationStatusLike | null
  attempts: number
  at: string | null
}

/** Freshness has to be visible for a delivery failure to be actionable. */
export function formatAlertDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** One line for the Site chrome, where a full notice does not fit. */
export function watchAlertSummary(state: WatchAlertDeliveryState): string | null {
  if (state === 'undelivered') return WATCH_ALERT_DELIVERY.sidebarUndelivered
  if (state === 'delivering') return WATCH_ALERT_DELIVERY.sidebarDelivering
  return null
}
