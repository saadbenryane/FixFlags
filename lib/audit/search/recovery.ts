import { searchAttentionSchema, type SearchReceipt } from './contracts'

/** Share scope and freshness rules between explicit fixes and automatic recovery. */
export function assessSearchRecovery(receipt: SearchReceipt, checkId: string, attentionPolicy: unknown) {
  const policy = searchAttentionSchema.safeParse(attentionPolicy)
  const sources = policy.success ? policy.data.sources ?? [] : []
  const observations = receipt.observations.filter(item => item.checkId === checkId && (!sources.length || sources.includes(item.source)))
  const expectedTypes = policy.success ? policy.data.entityTypes ?? [] : []
  const typesObserved = new Set(observations.flatMap(item => item.entityTypes ?? []))
  const comparable = observations.length > 0 && !receipt.observations.some(item => item.reason === 'observation_limit') &&
    observations.every(item => item.disposition !== 'unknown' && item.disposition !== 'not_applicable') &&
    sources.every(source => observations.some(item => item.source === source)) && expectedTypes.every(type => typesObserved.has(type))
  const googleComparable = observations.every(item => {
    if (item.source !== 'google-index') return true
    const current = item.google, before = policy.success ? policy.data.google : undefined
    if (!current || !before || current.property !== before.property) return false
    return item.disposition === 'failed' || item.disposition === 'passed' && Boolean(current.lastCrawlAt && before.lastCrawlAt &&
      new Date(current.lastCrawlAt) > new Date(before.lastCrawlAt))
  })
  const verifiedConflictRemoval = policy.success && policy.data.reason === 'sitemap_indexing_conflict' &&
    receipt.complete && observations.every(item => item.reason === 'declared_indexing_exclusion' || item.disposition === 'passed')
  const targets = policy.success ? policy.data.markupTargets ?? [] : []
  const verifiedProperties = targets.length > 0 && targets.every(target => observations.some(item =>
    item.entityId === target.entityId && item.entityTypes?.includes(target.entityType) && item.source === target.source &&
    item.invalidProperties !== undefined && !target.properties.some(property => item.invalidProperties!.includes(property))))
  const verdict = !comparable || !googleComparable ? 'unknown' : observations.some(item => item.disposition === 'failed') ? 'failed'
    : observations.every(item => item.disposition === 'passed') || verifiedConflictRemoval || verifiedProperties ? 'passed' : 'unknown'
  return { comparable: comparable && verdict !== 'unknown', verdict, observationIds: observations.map(item => item.id) }
}
