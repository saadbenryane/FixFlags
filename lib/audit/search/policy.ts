import { searchAttentionSchema, type SearchAttention } from './contracts'

/** Approved SEO-specific corrections. Other detection policy remains unchanged. */
const HISTORICAL_RECOMMENDATIONS = new Set([
  'title-too-short', 'title-too-long', 'description-missing', 'description-too-short', 'description-too-long',
  'h1-missing', 'h1-multiple', 'canonical-missing', 'no-structured-data', 'sitemap-missing', 'robots-txt-missing',
  'low-ctr', 'canonical-mismatch',
])
const HISTORICAL_DECLARATIONS = new Set(['robots-blocks-indexing', 'robots-blocked', 'noindex-meta', 'indexing-failure', 'soft-404'])

export function searchAttentionDecision(flag: { checkId?: string | null; attentionPolicy?: unknown }): SearchAttention | null {
  const current = searchAttentionSchema.safeParse(flag.attentionPolicy)
  if (current.success) return current.data
  const id = (flag.checkId ?? '').split('::page:')[0]
  if (HISTORICAL_RECOMMENDATIONS.has(id)) return { policy: 'search', version: 1, kind: 'recommendation', reason: 'historical_optional_or_heuristic_guidance' }
  if (HISTORICAL_DECLARATIONS.has(id)) return { policy: 'search', version: 1, kind: 'observation', reason: 'historical_intent_not_established' }
  return null
}

/** Only classification belongs in client projections, never connected-provider context. */
export function presentationAttentionPolicy(value: unknown): SearchAttention | undefined {
  const parsed = searchAttentionSchema.safeParse(value)
  if (!parsed.success) return undefined
  const { policy, version, kind, reason } = parsed.data
  return { policy, version, kind, reason }
}
