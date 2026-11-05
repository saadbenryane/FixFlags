import { z } from 'zod'
import { supportingObservationViewSchema } from '@/lib/audit/flag-observations'
import { FLAG_VERIFICATION_FEEDBACK_RESULTS } from './flag-resolution'

/** Only the public evidence needed by the dashboard, never Site or account records. */
export const siteFlagPanelSchema = z.object({
  flag: z.object({
    id: z.string(), sourceFlagId: z.string().nullable(), sourceAuditId: z.string(),
    checkId: z.string().nullable(),
    problem: z.string(), evidence: z.string(), evidenceMissing: z.boolean(),
    whyItMatters: z.string(), expectedBehavior: z.string(), fix: z.string(),
    repairGuidance: z.enum(['ready', 'pending', 'unavailable']),
    pageUrl: z.string().nullable(), affectedPaths: z.array(z.string()), viewport: z.string().nullable(),
    supportingObservations: z.array(supportingObservationViewSchema), supportingEvidenceUnreadable: z.boolean(),
    performanceEvidenceSource: z.enum(['lab', 'field']).nullable(),
    verifying: z.boolean(), status: z.string(),
    verificationFeedback: z.object({ result: z.enum(FLAG_VERIFICATION_FEEDBACK_RESULTS), checkedAt: z.string().datetime().nullable() }).nullable().optional(),
  }),
  capture: z.object({ url: z.string(), recordedAt: z.string() }).nullable(),
})
export type SiteFlagPanelData = z.infer<typeof siteFlagPanelSchema>
