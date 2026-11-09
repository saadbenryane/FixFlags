import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { recordedSiteAssessmentSchema } from '@/lib/sites/assessment-contract'
import { hasUnresolvedFlagEvidence } from './attention'

export const FLAG_COMPARISON_TARGET = 'projection:flag-comparison'
export const flagComparisonAuditScopeSelect = {
  parentId: true, projectId: true, parent: { select: { projectId: true } },
} satisfies Prisma.AuditSelect
export type FlagComparisonAuditScope = Prisma.AuditGetPayload<{ select: typeof flagComparisonAuditScopeSelect }>

export class FlagComparisonUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FlagComparisonUnavailable'
  }
}

export function assertFlagComparisonSite(projectId: string | null | undefined, parentProjectId: string | null | undefined) {
  // Unassigned legacy reports can predate the claim that attached the child.
  if (parentProjectId && parentProjectId !== projectId) throw new FlagComparisonUnavailable('Flag comparison requires a parent from the same Site.')
}

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
export type FlagComparisonResult = { summary: FlagDiffSummary; verifiedRecoveryIds?: string[] }

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
export function readFlagComparison(detail: unknown, expected: FlagComparisonAuditScope & { id: string }): FlagDiffSummary {
  return readFlagComparisonFacts(detail, expected).summary
}

/** Supplementary conclusion corruption cannot conceal valid recorded findings.
 * Its own consumer validates that conclusion independently and fails closed. */
export function readFlagComparisonFacts(detail: unknown, expected: FlagComparisonAuditScope & { id: string }) {
  assertFlagComparisonSite(expected.projectId, expected.parent?.projectId)
  const result = comparisonFactsSchema.safeParse(detail)
  if (!result.success || result.data.auditId !== expected.id || result.data.parentAuditId !== expected.parentId)
    throw new FlagComparisonUnavailable('The completed Flag comparison does not match this execution.')
  return result.data
}

const recoveryReferenceSchema = z.object({ auditId: z.string(), parentAuditId: z.string().nullable(),
  verifiedRecoveryIds: z.array(z.string().min(1)) })

/** Evidence references can extend independently of the comparison payload.
 * An unreadable reference falls back to the original evidence. */
export function readComparisonRecoveryIds(value: unknown, facts: Pick<z.infer<typeof comparisonFactsSchema>, 'auditId' | 'parentAuditId' | 'summary'>) {
  const parsed = recoveryReferenceSchema.safeParse(value)
  if (!parsed.success || parsed.data.auditId !== facts.auditId || parsed.data.parentAuditId !== facts.parentAuditId) return undefined
  const fixed = new Set(facts.summary.fixed.filter(flag => !flag.supportingEvidenceUnreadable).map(flag => flag.id))
  return parsed.data.verifiedRecoveryIds.every(id => fixed.has(id)) ? parsed.data.verifiedRecoveryIds : undefined
}
