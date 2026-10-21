import { z } from 'zod'

const area = z.enum(['uptime', 'site', 'security', 'search', 'performance', 'conversion', 'tracking', 'accessibility'])
export const siteAssessmentSchema = z.object({
  result: z.enum(['CLEAR', 'FLAG', 'COULD_NOT_VERIFY', 'STALE', 'FAILED']).nullable(),
  completeness: z.enum(['FULL', 'PARTIAL', 'PENDING']),
  requiredAreas: z.array(area),
  gaps: z.array(z.object({ area: area.nullable(), outcomeId: z.string().optional(),
    reason: z.enum(['missing', 'incomplete', 'stale', 'pages', 'unassessed']) }).strict()),
  checkedAt: z.string().datetime().nullable(), validUntil: z.string().datetime().nullable(),
}).strict()
export type SiteAssessment = z.infer<typeof siteAssessmentSchema>
export type AssessmentGap = SiteAssessment['gaps'][number]

/** Publication freezes the conclusion and the exact admitted responsibility.
 * Current Site assurance still applies today's policy to the original evidence. */
export const recordedSiteAssessmentSchema = z.object({
  version: z.literal(1), specHash: z.string().regex(/^[a-f0-9]{64}$/),
  customerFlags: z.array(z.object({ group: z.enum(['newIssues', 'unchanged', 'regressed', 'inconclusive']), index: z.number().int().nonnegative() }).strict()),
  assessment: siteAssessmentSchema.extend({
    result: z.enum(['CLEAR', 'FLAG', 'COULD_NOT_VERIFY', 'STALE']),
    completeness: z.enum(['FULL', 'PARTIAL']), checkedAt: z.string().datetime(),
  }),
}).strict().superRefine((recorded, context) => {
  const value = recorded.assessment, incomplete = value.gaps.some(gap => gap.reason !== 'stale')
  if (new Set(value.requiredAreas).size !== value.requiredAreas.length ||
    (value.completeness === 'PARTIAL') !== incomplete ||
    value.result === 'CLEAR' && (value.gaps.length > 0 || !value.validUntil || Date.parse(value.validUntil) <= Date.parse(value.checkedAt)) ||
    value.result === 'COULD_NOT_VERIFY' && !incomplete ||
    value.result === 'STALE' && (incomplete || !value.gaps.some(gap => gap.reason === 'stale')) ||
    recorded.customerFlags.length > 0 && value.result !== 'FLAG' ||
    new Set(recorded.customerFlags.map(item => item.group + ':' + item.index)).size !== recorded.customerFlags.length)
    context.addIssue({ code: 'custom', message: 'Inconsistent recorded Site conclusion' })
})
export type RecordedSiteAssessment = z.infer<typeof recordedSiteAssessmentSchema>
