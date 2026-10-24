import { z } from 'zod'
import { supportingObservationViewSchema } from '@/lib/audit/flag-observations'

/** Only the public evidence needed by the dashboard, never Site or account records. */
export const siteFlagPanelSchema = z.object({
  flag: z.object({
    id: z.string(), sourceFlagId: z.string().nullable(), sourceAuditId: z.string(),
    problem: z.string(), evidence: z.string(), evidenceMissing: z.boolean(),
    whyItMatters: z.string(), expectedBehavior: z.string(), fix: z.string(),
    repairGuidance: z.enum(['ready', 'pending', 'unavailable']),
    pageUrl: z.string().nullable(), affectedPaths: z.array(z.string()), viewport: z.string().nullable(),
    supportingObservations: z.array(supportingObservationViewSchema), supportingEvidenceUnreadable: z.boolean(),
    performanceEvidenceSource: z.enum(['lab', 'field']).nullable(),
    verifying: z.boolean(), status: z.string(),
  }),
  capture: z.object({ url: z.string(), recordedAt: z.string() }).nullable(),
})
export type SiteFlagPanelData = z.infer<typeof siteFlagPanelSchema>
