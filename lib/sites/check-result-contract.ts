import { z } from 'zod'
import { CHECK_OBSERVATION_REASONS } from '@/lib/audit/checks/assertion'
import { searchObservationSchema } from '@/lib/audit/search/contracts'

export const siteCheckResultSchema = z.object({
  id: z.string(), auditId: z.string(), area: z.enum(['site', 'security', 'search', 'performance', 'conversion', 'tracking', 'uptime', 'accessibility']),
  name: z.string(), kind: z.enum(['execution', 'assertion']), status: z.enum(['passed', 'completed', 'findings', 'failed', 'not_applicable', 'observed', 'unknown']),
  pageUrl: z.string().nullable(), checkedAt: z.string(), historical: z.boolean(), limitation: z.string(), source: z.string(),
  evidenceReference: z.object({ auditId: z.string(), executionId: z.string(), pageUrl: z.string().nullable() }),
  reason: z.enum(CHECK_OBSERVATION_REASONS).optional(), assertionKey: z.string().optional(), observation: z.string().optional(), expected: z.string().optional(),
  search: searchObservationSchema.optional(),
})
export const siteCheckPageSchema = z.object({ results: z.array(siteCheckResultSchema), nextCursor: z.string().nullable(), total: z.number().int().nonnegative().nullable().optional() })
export const RESULT_SELECTION_CHANGED = 'RESULT_SELECTION_CHANGED'

export class CheckResultSelectionChanged extends Error {
  constructor(readonly reason: 'cursor' | 'evidence' = 'cursor') {
    super(reason === 'cursor' ? 'Invalid check history cursor' : 'Check evidence selection changed')
  }
}

export type SiteCheckResult = z.infer<typeof siteCheckResultSchema>
