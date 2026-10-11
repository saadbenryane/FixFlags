import { z } from 'zod'

export const searchSourceSchema = z.enum(['http', 'original-html', 'rendered-dom', 'robots-txt', 'sitemap', 'google-index', 'google-analytics'])
export const searchResponsibilitySchema = z.enum(['crawl', 'indexing', 'canonical', 'presentation', 'structured-data', 'discovery', 'google'])
export const googleEvidenceSchema = z.object({ property: z.string().min(1), verdict: z.string().optional(),
  lastCrawlAt: z.string().datetime({ offset: true }).optional(), dateRange: z.string().optional() }).strict()
export const markupTargetSchema = z.object({
  entityId: z.string().min(1), entityType: z.string().min(1), source: searchSourceSchema,
  properties: z.array(z.string().min(1)).min(1).max(30),
}).strict()
export const searchAttentionSchema = z.object({
  policy: z.literal('search'), version: z.literal(1),
  kind: z.enum(['flag', 'recommendation', 'observation']), reason: z.string().min(1),
  sources: z.array(searchSourceSchema).min(1).max(7).optional(),
  entityTypes: z.array(z.string()).max(200).optional(),
  google: googleEvidenceSchema.optional(),
  markupTargets: z.array(markupTargetSchema).max(200).optional(),
}).strict()
export type SearchAttention = z.infer<typeof searchAttentionSchema>

export const searchObservationSchema = z.object({
  id: z.string().min(1), checkId: z.string().min(1), checkVersion: z.literal(1),
  responsibility: searchResponsibilitySchema, name: z.string().min(1),
  disposition: z.enum(['passed', 'failed', 'observed', 'unknown', 'not_applicable']),
  reason: z.string().min(1), expected: z.string(), observed: z.string(),
  source: searchSourceSchema, collectedAt: z.string().datetime(), pageUrl: z.string().url(),
  attention: searchAttentionSchema,
  evidence: z.array(z.object({
    source: searchSourceSchema, url: z.string().url(), locator: z.string(),
    excerpt: z.string().max(2000), collectedAt: z.string().datetime(),
  }).strict()).max(20),
  limitation: z.string(), guidance: z.string(), entityTypes: z.array(z.string()).optional(),
  google: googleEvidenceSchema.optional(),
  entityId: z.string().optional(), invalidProperties: z.array(z.string()).max(30).optional(),
}).strict()
export type SearchObservation = z.infer<typeof searchObservationSchema>

export const searchReceiptSchema = z.object({
  kind: z.literal('search-checks'), version: z.literal(1), auditId: z.string().min(1),
  pageUrl: z.string().url(), collectedAt: z.string().datetime(), complete: z.boolean(),
  observations: z.array(searchObservationSchema).max(500),
}).strict().superRefine((receipt, context) => {
  const ids = new Set<string>()
  for (const item of receipt.observations) {
    if (item.pageUrl !== receipt.pageUrl || ids.has(item.id)) context.addIssue({ code: 'custom', message: 'Search observation scope or identity conflict' })
    ids.add(item.id)
  }
})
export type SearchReceipt = z.infer<typeof searchReceiptSchema>

export const searchVerifierSchema = z.object({
  kind: z.literal('search-verifier'), version: z.literal(1), auditId: z.string(), pageUrl: z.string().url(),
  checkId: z.string(), verdict: z.enum(['passed', 'failed', 'unknown']), comparable: z.boolean(),
  observationIds: z.array(z.string()).min(1).max(500), reason: z.string(),
}).strict()

export type PublicDocument = {
  url: string; finalUrl: string; status: number | null; headers: Record<string, string>;
  body: string | null; complete: boolean; reason: string | null; collectedAt: string; redirects: string[];
}
export type SearchPageEvidence = {
  auditId: string; pageUrl: string; collectedAt: string; public: boolean;
  original: PublicDocument; rendered: PublicDocument;
  robots: PublicDocument; sitemaps: PublicDocument[];
  sitemapUrls: string[]; sitemapsComplete: boolean; declaredSitemaps: string[];
  canonicalTargets: PublicDocument[];
}
