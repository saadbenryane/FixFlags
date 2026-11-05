'use client'

import { useMinuteClock } from './useMinuteClock'
import { currentOutcomeState, type CustomerOutcomeState } from '@/lib/sites/outcome-state'

/** Expiry can withdraw recorded assurance. Only a new source can restore it. */
export function useOutcomeState(state: CustomerOutcomeState, validUntil?: string | null, running = false) {
  const until = validUntil ? new Date(validUntil) : null
  const assessed = state === 'CLEAR' || state === 'FLAG'
  const canExpire = assessed && !running && until !== null && Number.isFinite(until.getTime())
  const now = useMinuteClock(canExpire)
  if (!assessed || !canExpire || !until || now === null) return state
  return currentOutcomeState({ state, validUntil: until }, new Date(now))
}
