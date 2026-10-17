import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'

export type RepairGuidanceState = 'ready' | 'pending' | 'unavailable'

export function hasRepairGuidance(fix: string | null | undefined): boolean {
  return Boolean(fix?.trim())
}

/** Historical indexing guidance retains its existing cautious compatibility meaning. */
export function repairGuidanceText(input: { fix?: string | null; checkId?: string | null; attentionPolicy?: unknown }): string {
  return searchAttentionDecision(input)?.reason === 'historical_intent_not_established'
    ? SEARCH_COPY.rules.indexing.guidance : input.fix ?? ''
}

/** Existing per-finding guidance remains usable independently of other prescriptions. */
export function repairGuidanceState(input: {
  fix?: string | null
  checkId?: string | null
  attentionPolicy?: unknown
  audit?: { includeAi?: boolean; triageAt?: Date | string | null; aiReviewAt?: Date | string | null; failureCode?: string | null }
}): RepairGuidanceState {
  if (hasRepairGuidance(repairGuidanceText(input))) return 'ready'
  const audit = input.audit
  return audit?.includeAi && audit.triageAt && !audit.aiReviewAt && !audit.failureCode ? 'pending' : 'unavailable'
}
