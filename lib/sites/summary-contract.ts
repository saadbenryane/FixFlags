import { z } from 'zod'
import type { SiteSummary } from './application/list-sites'
import { sitePresentationSchema } from './presentation-contract'

export const SITE_SUMMARY_OWNER_HEADER = 'x-fixflags-account-id'
export const SITE_SUMMARY_READ_AT_HEADER = 'x-fixflags-summary-read-at'
const siteSummarySchema: z.ZodType<SiteSummary> = z.object({
  id: z.string().min(1), name: z.string(), hostname: z.string(), presentation: sitePresentationSchema,
  lastUsefulChangeAt: z.string().datetime({ offset: true }),
}).refine(site => site.id === site.presentation.identity.siteId, 'Site summary identity mismatch')

export const siteSummariesSchema = z.array(siteSummarySchema)
