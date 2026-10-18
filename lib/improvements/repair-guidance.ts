import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { REPAIR_GUIDANCE_COPY as C } from '@/lib/marketing/copy/repair-guidance'

export type InspectionGuidancePlan = {
  inspection: string
  changeCondition: string
  changeIfConfirmed: string | null
  preserve: string
}

const fragment = (text: string) => text.trim().replace(/[.!?]+$/, '')

/** Present a validated inspection plan, never rewrite an invalid free-form task. */
export function formatInspectionGuidance(plan: InspectionGuidancePlan): string {
  return [C.inspection(fragment(plan.inspection)), C.confirmIntent, C.condition(fragment(plan.changeCondition)),
    plan.changeIfConfirmed ? C.confirmedChange(fragment(plan.changeIfConfirmed)) : C.noChange,
    C.preserve(fragment(plan.preserve))].join('\n')
}

export function formatCombinedRepairGuidance(rows: readonly {
  problem: string; evidence: string; fix: string; verificationRule?: string | null; supportingEvidence?: readonly string[]
}[]): string {
  if (!rows.length) return C.noFindings
  return rows.map((row, index) => [`${index + 1}. ${row.problem}`, C.observed(row.evidence),
    ...(row.supportingEvidence || []).map(C.supporting), row.fix,
    C.verify(row.verificationRule || C.verificationUnavailable)].join('\n')).join('\n\n')
}

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
