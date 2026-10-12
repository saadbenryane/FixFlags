import { z } from 'zod'

export const FLAG_COMPARISON_TARGET = 'projection:flag-comparison'

const itemSchema = z.object({
  id: z.string().optional(), checkId: z.string().nullable(), problem: z.string(), rubric: z.string(), severity: z.string(),
  status: z.string().optional(), confidence: z.number().nullable().optional(), impactTag: z.string().nullable().optional(),
  pageUrl: z.string().nullable().optional(), foundOnNewPage: z.boolean().optional(), attentionPolicy: z.unknown().optional(),
}).strict()

export const flagDiffSummarySchema = z.object({
  fixed: z.array(itemSchema), inconclusive: z.array(itemSchema), unchanged: z.array(itemSchema),
  regressed: z.array(itemSchema), newIssues: z.array(itemSchema),
}).strict()
export type FlagDiffSummary = z.infer<typeof flagDiffSummarySchema>

export const flagComparisonSchema = z.object({
  kind: z.literal('flag-comparison'), version: z.literal(1), auditId: z.string(), parentAuditId: z.string().nullable(),
  summary: flagDiffSummarySchema,
}).strict()

/** A completed comparison is a projection of observed facts, not a verifier
 * assertion. The Audit relation owns current Site access, including claiming an
 * anonymous analysis. Invalid or unrelated facts cannot fall back to success. */
export function readFlagComparison(detail: unknown, expected: { auditId: string; parentAuditId: string | null }): FlagDiffSummary {
  const result = flagComparisonSchema.safeParse(detail)
  if (!result.success || result.data.auditId !== expected.auditId || result.data.parentAuditId !== expected.parentAuditId)
    throw new Error('The completed Flag comparison does not match this execution.')
  return result.data.summary
}
