import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { REPAIR_GUIDANCE_COPY as C } from '@/lib/marketing/copy/repair-guidance'
import { isConditionalInspection, isUsableFixPrompt, requiresContextualReview } from '@/lib/audit/prescription-policy'
import type { AgentPrompts } from '@/lib/audit/flag-types'
import { hasUnavailableFlagEvidence } from '@/lib/audit/attention'

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
  problem: string
  fix: string
  scopes: readonly { problem: string; evidence: string; pageUrl?: string | null; verificationRule?: string | null; supportingEvidence?: readonly string[] }[]
}[]): string {
  if (!rows.length) return C.noFindings
  return rows.map((row, index) => [`${index + 1}. ${row.problem}`,
    ...row.scopes.flatMap(scope => [scope.pageUrl ? C.page(scope.pageUrl) : '',
      scope.problem !== row.problem ? C.problem(scope.problem) : '', C.observed(scope.evidence),
      ...(scope.supportingEvidence || []).map(C.supporting)]).filter(Boolean), row.fix,
    ...row.scopes.map(scope => C.verify(scope.verificationRule || C.verificationUnavailable, scope.pageUrl)),
  ].join('\n')).join('\n\n')
}

export type RepairGuidanceState = 'ready' | 'pending' | 'unavailable'

export function hasRepairGuidance(fix: string | null | undefined): boolean {
  return isUsableFixPrompt(fix)
}

export type RepairGuidanceInput = Partial<AgentPrompts> & {
  fix?: string | null; checkId?: string | null; attentionPolicy?: unknown
  supportingObservations?: unknown; supportingEvidenceUnreadable?: boolean
}

/** One task selection for individual report actions and composed editor handoffs. */
export function effectiveRepairGuidance(input: RepairGuidanceInput): string | null {
  if (hasUnavailableFlagEvidence(input)) return null
  if (searchAttentionDecision(input)?.reason === 'historical_intent_not_established') return SEARCH_COPY.rules.indexing.guidance
  const contextual = requiresContextualReview(input.checkId)
  const editors = [input.agentPrompt, input.cursorPrompt, input.claudePrompt, input.windsurfPrompt, input.lovablePrompt, input.boltPrompt]
  for (const candidate of contextual ? [input.fix, ...editors] : [...editors, input.fix]) {
    if (isUsableFixPrompt(candidate) && (!contextual || isConditionalInspection(candidate))) return candidate.trim()
  }
  return null
}

/** Compatibility text access uses the same task as rendered actions and commands. */
export function repairGuidanceText(input: RepairGuidanceInput): string {
  return effectiveRepairGuidance(input) ?? ''
}

/** Existing per-finding guidance remains usable independently of other prescriptions. */
export function repairGuidanceState(input: RepairGuidanceInput & {
  audit?: { includeAi?: boolean; triageAt?: Date | string | null; aiReviewAt?: Date | string | null; failureCode?: string | null }
}): RepairGuidanceState {
  if (hasUnavailableFlagEvidence(input)) return 'unavailable'
  if (hasRepairGuidance(repairGuidanceText(input))) return 'ready'
  const audit = input.audit
  return audit?.includeAi && audit.triageAt && !audit.aiReviewAt && !audit.failureCode ? 'pending' : 'unavailable'
}
