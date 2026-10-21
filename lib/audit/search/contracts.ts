import { z } from 'zod'
import { renderedSearchSnapshotSchema } from './rendered-snapshot'
import { certificateFailureSchema } from '../tls-evidence'

export const SITEMAP_DOCUMENT_LIMIT = 5
export const SITEMAP_URL_LIMIT = 10_000
export const SEARCH_OBSERVATION_LIMIT = 500
export const STRUCTURED_PROPERTY_LIMIT = 30

export const searchSourceSchema = z.enum(['http', 'original-html', 'rendered-dom', 'robots-txt', 'sitemap', 'google-index', 'google-analytics'])
export const searchResponsibilitySchema = z.enum(['crawl', 'indexing', 'canonical', 'presentation', 'structured-data', 'discovery', 'google'])
export const googleEvidenceSchema = z.object({ property: z.string().min(1), verdict: z.string().optional(),
  lastCrawlAt: z.string().datetime({ offset: true }).optional(), dateRange: z.string().optional(),
  pageFetchState: z.string().optional(), robotsTxtState: z.string().optional(), indexingState: z.string().optional(),
  googleCanonical: z.string().url().optional(), userCanonical: z.string().url().optional() }).strict()
export const markupTargetSchema = z.object({
  entityId: z.string().min(1), entityType: z.string().min(1), source: searchSourceSchema,
  properties: z.array(z.string().min(1)).min(1).max(STRUCTURED_PROPERTY_LIMIT),
}).strict()
const resourceKeysSchema = z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1).max(200)
export const searchPageScopeSchema = z.object({
  pageUrl: z.string().url(), reason: z.string().min(1), version: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  sources: z.array(searchSourceSchema).min(1).max(7).optional(),
  entityTypes: z.array(z.string()).max(200).optional(), google: googleEvidenceSchema.optional(),
  markupTargets: z.array(markupTargetSchema).max(SEARCH_OBSERVATION_LIMIT).optional(),
  resourceKeys: resourceKeysSchema.optional(),
}).strict()
export const searchAttentionSchema = z.object({
  policy: z.literal('search'), version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  kind: z.enum(['flag', 'recommendation', 'observation']), reason: z.string().min(1),
  sources: z.array(searchSourceSchema).min(1).max(7).optional(),
  entityTypes: z.array(z.string()).max(200).optional(),
  google: googleEvidenceSchema.optional(),
  markupTargets: z.array(markupTargetSchema).max(SEARCH_OBSERVATION_LIMIT).optional(),
  resourceKeys: resourceKeysSchema.optional(),
  pageScopes: z.array(searchPageScopeSchema).min(1).max(500).optional(),
}).strict()
export type SearchAttention = z.infer<typeof searchAttentionSchema>

export const searchObservationSchema = z.object({
  id: z.string().min(1), checkId: z.string().min(1), checkVersion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
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
  entityId: z.string().optional(), invalidProperties: z.array(z.string()).max(STRUCTURED_PROPERTY_LIMIT).optional(),
  resourceKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict()
export type SearchObservation = z.infer<typeof searchObservationSchema>

export const searchReceiptSchema = z.object({
  kind: z.literal('search-checks'), version: z.literal(1), auditId: z.string().min(1),
  pageUrl: z.string().url(), collectedAt: z.string().datetime(), complete: z.boolean(),
  observations: z.array(searchObservationSchema).max(SEARCH_OBSERVATION_LIMIT),
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

/** The collector, persisted documents and isolated parser share this boundary. */
export const publicDocumentSchema = z.object({
  url: z.string().url(), finalUrl: z.string().url(), status: z.number().int().nullable(),
  headers: z.record(z.string(), z.string().max(32_000)), body: z.string().max(1_000_000).nullable(), complete: z.boolean(),
  reason: z.string().nullable(), collectedAt: z.string().datetime(), redirects: z.array(z.string().url()).max(5),
  searchSnapshot: renderedSearchSnapshotSchema.optional(),
  transportFailure: certificateFailureSchema.optional(),
}).strict().superRefine((document, context) => {
  if (!document.transportFailure) return
  let https = false
  try { https = new URL(document.finalUrl).protocol === 'https:' } catch { /* URL validation reports malformed evidence. */ }
  if (document.status !== null || document.body !== null || document.complete ||
    Object.keys(document.headers).length > 0 || !https)
    context.addIssue({ code: 'custom', message: 'A certificate refusal cannot establish an HTTP response' })
})
export const searchPageEvidenceSchema = z.object({
  auditId: z.string(), pageUrl: z.string().url(), collectedAt: z.string().datetime(), public: z.boolean(),
  collectorVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  original: publicDocumentSchema, rendered: publicDocumentSchema, robots: publicDocumentSchema,
  sitemaps: z.array(publicDocumentSchema).max(SITEMAP_DOCUMENT_LIMIT), sitemapUrls: z.array(z.string().url()).max(SITEMAP_URL_LIMIT),
  sitemapsComplete: z.boolean(), declaredSitemaps: z.array(z.string()).max(SITEMAP_URL_LIMIT),
  canonicalTargets: z.array(publicDocumentSchema).max(3),
}).strict()
export type PublicDocument = z.infer<typeof publicDocumentSchema>
export type SearchPageEvidence = z.infer<typeof searchPageEvidenceSchema>
