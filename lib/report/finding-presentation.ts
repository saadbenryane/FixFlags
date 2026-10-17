import type { Prisma } from '@prisma/client'
import { isCustomerFlag, isResolvedFlagStatus, type CustomerFlagInput } from '@/lib/audit/attention'
import { hasUnreadableSupportingObservations } from '@/lib/audit/flag-observations'
import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SAVED_FINDING_COPY } from '@/lib/marketing/copy/flags'

/** Keep policy evidence available until classification, before limiting presentation. */
export const REPORT_FINDING_POLICY_SELECT = {
  severity: true, problem: true, checkId: true, rubric: true, confidence: true,
  impactTag: true, status: true, attentionPolicy: true, supportingObservations: true,
} as const satisfies Prisma.FlagSelect

export function savedFindingLabel(finding: CustomerFlagInput): string {
  if (isCustomerFlag(finding)) return SAVED_FINDING_COPY.flag(finding.severity)
  if (searchAttentionDecision(finding)?.kind === 'observation' ||
    isResolvedFlagStatus(finding.status) || finding.supportingEvidenceUnreadable ||
    hasUnreadableSupportingObservations(finding.supportingObservations)) return SAVED_FINDING_COPY.observation
  return SAVED_FINDING_COPY.recommendation
}

/** A historical verdict alone cannot establish a current priority finding. */
export function recordedPrioritySummary(findings: Array<CustomerFlagInput & { problem: string }>): string {
  return findings.find(isCustomerFlag)?.problem ?? SAVED_FINDING_COPY.summary
}
