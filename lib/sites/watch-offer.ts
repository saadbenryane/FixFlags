import { WATCH_OFFER } from '@/lib/marketing/copy'
import type { WatchBoardState } from '@/lib/sites/watch-state'

/**
 * What Home says when FixFlags is not watching.
 *
 * Home's documented question is "what is FixFlags watching", and when Watch is
 * off the honest answer is "nothing yet". A sidebar reading "Not watching" does
 * not answer that on the surface whose question it is, and a customer who just
 * received Flags has no reason to guess that the thing which distinguishes
 * FixFlags from a one-shot report is switched off.
 *
 * This states the gap. It does not close it by itself. Watch configuration
 * belongs to Site settings, and turning it on sends email, so the choice stays
 * the customer's and stays where the information architecture puts it.
 *
 * Only a genuinely off Watch is worth a line. `paused`, `delayed` and `quota`
 * already have their own labels and reasons, and restating them here would be
 * noise that trains people to ignore the area.
 */
export type WatchOffNotice = {
  title: string
  body: string
  actionLabel: string
  /** Site settings owns Watch configuration, so the notice points there. */
  actionHref: string
}

export function watchOffNotice(input: {
  state: WatchBoardState
  siteId: string
}): WatchOffNotice | null {
  if (input.state !== 'off') return null
  return {
    title: WATCH_OFFER.title,
    body: WATCH_OFFER.body,
    actionLabel: WATCH_OFFER.actionLabel,
    actionHref: `/sites/${input.siteId}/settings`,
  }
}
