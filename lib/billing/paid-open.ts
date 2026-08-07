/**
 * Paid checkout gate. When false, Pro/Studio CTAs route to waitlist instead of Stripe.
 *
 * Batch awareness: STRIPE_PAID_OPEN is the MASTER switch (a kill switch for all
 * paid checkout). WAITLIST_OPEN_BATCH then controls cohort release on top of it:
 * a waitlist member whose batch is released (batch <= WAITLIST_OPEN_BATCH) or who
 * holds an explicit access grant may check out; others get a 403
 * BATCH_ACCESS_REQUIRED even while paid is open. The master switch is never
 * bypassed by a batch value.
 */

export function isPaidOpenServer(): boolean {
  return process.env.STRIPE_PAID_OPEN === 'true'
}

/** Client bundle: must match STRIPE_PAID_OPEN on the server. */
export function isPaidOpenClient(): boolean {
  return process.env.NEXT_PUBLIC_PAID_OPEN === 'true'
}

export function isPaidCheckoutGatedClient(): boolean {
  return !isPaidOpenClient()
}

/**
 * Highest released batch from WAITLIST_OPEN_BATCH (e.g. "1" or "2"). 0 when
 * unset or invalid: no batch is open, so waitlist members cannot check out even
 * if the master switch is on. Reading the env here keeps the value server-side
 * only (never shipped to the client bundle).
 */
export function openBatch(): number {
  const raw = process.env.WAITLIST_OPEN_BATCH
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0
}

/** True when a member's batch has been released (batch 1 and 2 open in order). */
export function isBatchReleased(batch: number | null | undefined): boolean {
  if (batch == null || batch <= 0) return false
  return batch <= openBatch()
}
