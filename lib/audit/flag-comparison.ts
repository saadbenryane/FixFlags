import { z } from 'zod'
import { recordedSiteAssessmentSchema } from '@/lib/sites/assessment-contract'
import { hasUnresolvedFlagEvidence } from './attention'

export const FLAG_COMPARISON_TARGET = 'projection:flag-comparison'

const itemSchema = z.object({
  id: z.string().optional(), checkId: z.string().nullable(), problem: z.string(), rubric: z.string(), severity: z.string(),
  status: z.string().optional(), confidence: z.number().nullable().optional(), impactTag: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(), foundOnNewPage: z.boolean().optional(), attentionPolicy: z.unknown().optional(),
  supportingEvidenceUnreadable: z.boolean().optional(),
}).strict()

export const flagDiffSummarySchema = z.object({
  fixed: z.array(itemSchema), inconclusive: z.array(itemSchema), unchanged: z.array(itemSchema),
  regressed: z.array(itemSchema), newIssues: z.array(itemSchema),
}).strict()
export type FlagDiffSummary = z.infer<typeof flagDiffSummarySchema>

/** Unreadable original evidence cannot establish either failure or recovery. */
export function comparisonEvidenceComplete(summary: FlagDiffSummary): boolean {
  return ![...summary.newIssues, ...summary.unchanged, ...summary.regressed, ...summary.inconclusive,
    ...summary.fixed.map(flag => ({ ...flag, status: 'OPEN' }))].some(hasUnresolvedFlagEvidence)
}

const comparisonFactsSchema = z.object({
  kind: z.literal('flag-comparison'), version: z.literal(1), auditId: z.string(), parentAuditId: z.string().nullable(),
  summary: flagDiffSummarySchema, siteAssessment: z.unknown().optional(),
}).strict()
export const flagComparisonSchema = comparisonFactsSchema.extend({ siteAssessment: recordedSiteAssessmentSchema.optional() })

/** A completed comparison is a projection of observed facts, not a verifier
 * assertion. The Audit relation owns current Site access, including claiming an
 * anonymous analysis. Invalid or unrelated facts cannot fall back to success. */
export function readFlagComparison(detail: unknown, expected: { auditId: string; parentAuditId: string | null }): FlagDiffSummary {
  return readFlagComparisonFacts(detail, expected).summary
}

/** Supplementary conclusion corruption cannot conceal valid recorded findings.
 * Its own consumer validates that conclusion independently and fails closed. */
export function readFlagComparisonFacts(detail: unknown, expected: { auditId: string; parentAuditId: string | null }) {
  const result = comparisonFactsSchema.safeParse(detail)
  if (!result.success || result.data.auditId !== expected.auditId || result.data.parentAuditId !== expected.parentAuditId)
    throw new Error('The completed Flag comparison does not match this execution.')
  return result.data
}
