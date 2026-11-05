'use client'

import { useOutcomeState } from '@/hooks/useOutcomeState'
import { outcomeStatusLabel, type CustomerOutcomeState } from '@/lib/sites/outcome-state'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'

export function OutcomeStateLabel({ state, validUntil, running, enabled }: {
  state: CustomerOutcomeState; validUntil?: string | null; running: boolean; enabled: boolean;
}) {
  const current = useOutcomeState(state, validUntil, running || !enabled)
  return enabled ? outcomeStatusLabel(current, running) : OUTCOME_DETAIL_COPY.paused
}
