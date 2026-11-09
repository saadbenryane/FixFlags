import { z } from 'zod'
import { renderedSearchSnapshotSchema } from './rendered-snapshot'
import { certificateFailureSchema } from '../tls-evidence'
import { responseEvidenceHeaders } from '../http-evidence'
import { SEARCH_CHECK_REGISTRY, SEARCH_LOCAL_MODULES, type SearchCheckIdentity } from './definitions'

export const SITEMAP_DOCUMENT_LIMIT = 5
export const SITEMAP_URL_LIMIT = 10_000
export const SITEMAP_STRUCTURE_VERSION = 2
export const SITEMAP_SYNTAX_VERSION = 6
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
const searchDetectorVersionSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)])
export const searchPageScopeSchema = z.object({
  pageUrl: z.string().url(), reason: z.string().min(1), version: searchDetectorVersionSchema.optional(),
  sources: z.array(searchSourceSchema).min(1).max(7).optional(),
  entityTypes: z.array(z.string()).max(200).optional(), google: googleEvidenceSchema.optional(),
  markupTargets: z.array(markupTargetSchema).max(SEARCH_OBSERVATION_LIMIT).optional(),
  resourceKeys: resourceKeysSchema.optional(),
}).strict()
export const searchAttentionSchema = z.object({
  policy: z.literal('search'), version: searchDetectorVersionSchema,
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
  id: z.string().min(1), checkId: z.string().min(1), checkVersion: searchDetectorVersionSchema,
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
  validatedProperties: z.array(z.string()).max(STRUCTURED_PROPERTY_LIMIT).optional(),
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
export const searchComparisonBaselineSchema = z.object({
  pageUrl: searchReceiptSchema.shape.pageUrl, observations: searchReceiptSchema.shape.observations,
}).strict()
export type SearchComparisonBaseline = z.infer<typeof searchComparisonBaselineSchema>

export type RecordedSearchExecution = {
  targetKey: string; detail?: unknown; status?: string; pageUrl?: string | null; auditId?: string;
}

function searchObservationMatchesTarget(targetKey: string, observation: SearchObservation): boolean {
  if (targetKey !== 'module:search' && !targetKey.startsWith('module:search-')) return false
  const target = targetKey.slice('module:search-'.length)
  if (observation.checkId === 'search-observation-coverage' && observation.reason === 'observation_limit' && observation.disposition === 'unknown')
    return !observation.source.startsWith('google-') && (targetKey === 'module:search' ||
      SEARCH_LOCAL_MODULES.includes(targetKey) && observation.responsibility === target)
  if (!Object.hasOwn(SEARCH_CHECK_REGISTRY, observation.checkId)) return false
  const definition = SEARCH_CHECK_REGISTRY[observation.checkId as SearchCheckIdentity]
  if (observation.responsibility !== definition.responsibility) return false
  if (definition.evaluator === 'google') {
    const performance = observation.checkId === 'search-google-performance' || observation.checkId === 'low-ctr'
    return observation.source === (performance ? 'google-analytics' : 'google-index') &&
      (target === 'google' || target === (performance ? 'google-performance' : 'google-index'))
  }
  return !observation.source.startsWith('google-') && (target === definition.evaluator ||
    targetKey === 'module:search' && definition.evaluator !== 'cross-page')
}

export function classifyRecordedSearchReceipt(execution: RecordedSearchExecution,
  scope?: { auditId: string; pages: ReadonlySet<string> }):
  { state: 'out_of_scope' | 'unavailable' } | { state: 'recorded'; receipt: SearchReceipt; rejectedCheckIds: string[] } {
  if (scope && (execution.auditId !== undefined && execution.auditId !== scope.auditId ||
    execution.pageUrl != null && !scope.pages.has(execution.pageUrl))) return { state: 'out_of_scope' }
  const parsed = searchReceiptSchema.safeParse(execution.detail)
  if (!parsed.success) return { state: 'unavailable' }
  const receipt = parsed.data
  if (execution.pageUrl != null && execution.pageUrl !== receipt.pageUrl ||
    execution.auditId !== undefined && execution.auditId !== receipt.auditId ||
    scope && (receipt.auditId !== scope.auditId || !scope.pages.has(receipt.pageUrl))) return { state: 'out_of_scope' }
  if (execution.pageUrl === null || execution.status !== undefined && execution.status !== 'COMPLETED') return { state: 'unavailable' }
  const rejected = new Set<string>()
  const observations = receipt.observations.filter(item => {
    if (searchObservationMatchesTarget(execution.targetKey, item)) return true
    rejected.add(item.checkId)
    return false
  })
  return { state: 'recorded', receipt: rejected.size ? { ...receipt, complete: false, observations } : receipt,
    rejectedCheckIds: [...rejected] }
}

/** Recorded completion and ownership constrain the receipt, independently of
 * its optimistic summary. Missing legacy ledger fields cannot be invented. */
export function readRecordedSearchReceipt(execution: RecordedSearchExecution): SearchReceipt | null {
  const result = classifyRecordedSearchReceipt(execution)
  return result.state === 'recorded' && !result.rejectedCheckIds.length ? result.receipt : null
}

export const searchVerifierSchema = z.object({
  kind: z.literal('search-verifier'), version: z.literal(1), auditId: z.string(), pageUrl: z.string().url(),
  checkId: z.string(), verdict: z.enum(['passed', 'failed', 'unknown']), comparable: z.boolean(),
  observationIds: z.array(z.string()).min(1).max(500), reason: z.string(),
}).strict()

/** The collector, persisted documents and isolated parser share this boundary. */
export const publicDocumentSchema = z.object({
  url: z.string().url(), finalUrl: z.string().url(), status: z.number().int().nullable(),
  headers: z.record(z.string(), z.string().max(32_000)).transform(headers => responseEvidenceHeaders(Object.entries(headers))),
  body: z.string().max(1_000_000).nullable(), complete: z.boolean(),
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
  renderedResponseScoped: z.boolean().optional(),
  original: publicDocumentSchema, rendered: publicDocumentSchema, robots: publicDocumentSchema,
  redirectRobots: z.array(publicDocumentSchema).max(5).optional(),
  sitemaps: z.array(publicDocumentSchema).max(SITEMAP_DOCUMENT_LIMIT), sitemapUrls: z.array(z.string().url()).max(SITEMAP_URL_LIMIT),
  sitemapsComplete: z.boolean(), declaredSitemaps: z.array(z.string()).max(SITEMAP_URL_LIMIT),
  canonicalTargets: z.array(publicDocumentSchema).max(3),
}).strict()
export type PublicDocument = z.infer<typeof publicDocumentSchema>
export type SearchPageEvidence = z.infer<typeof searchPageEvidenceSchema>
