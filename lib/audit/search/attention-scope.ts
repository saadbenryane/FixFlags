import { searchAttentionSchema, searchPageScopeSchema, type SearchAttention } from './contracts'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'

/** Property scopes distinguish monitoring observations within the same
 * grouped Search check. Legacy policies without page scopes stay unqualified. */
export function structuredFailureKeys(value: unknown): Set<string> | undefined {
  const policy = searchAttentionSchema.safeParse(value)
  const scopes = policy.success ? policy.data.pageScopes : undefined
  if (!scopes?.length || scopes.some(scope => !scope.markupTargets?.length)) return undefined
  return new Set(scopes.flatMap(scope => scope.markupTargets!.flatMap(target => target.properties.map(property =>
    JSON.stringify([normalizeVerifierUrl(scope.pageUrl), target.source, target.entityId, target.entityType, property])))))
}

/** New producers bind recovery requirements to the page that supplied them. */
export function pageScopedSearchAttention(policy: SearchAttention, pageUrl: string): SearchAttention {
  const { reason, sources, entityTypes, google, markupTargets, resourceKeys } = policy
  return { ...policy, pageScopes: [searchPageScopeSchema.parse({ pageUrl, version: policy.version, reason, sources, entityTypes, google, markupTargets, resourceKeys })] }
}

/** Keep every original scope through repeated finding projections. Historical
 * policies without page provenance do not acquire invented peer-page scopes. */
export function mergeSearchAttentionPolicies(values: unknown[], representative: unknown): SearchAttention | null {
  const selected = searchAttentionSchema.safeParse(representative)
  if (!selected.success) return null
  const scopes = values.flatMap(value => {
    const parsed = searchAttentionSchema.safeParse(value)
    return parsed.success ? (parsed.data.pageScopes ?? []).map(scope => ({ ...scope, version: scope.version ?? parsed.data.version })) : []
  })
  if (!scopes.length) return selected.data
  return searchAttentionSchema.parse({ ...selected.data,
    pageScopes: [...new Map(scopes.map(scope => [JSON.stringify(scope), scope])).values()] })
}
