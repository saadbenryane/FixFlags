import { searchAttentionSchema, SITEMAP_SYNTAX_VERSION, type SearchObservation, type SearchReceipt } from './contracts'
import { normalizeVerifierUrl } from '@/lib/improvements/verifier-scope'
import type { SupportingObservation } from '../flag-observations'
import { legacyCanonicalFlagKeys, legacyCanonicalObservationKey } from './legacy-canonical'

/** Share scope and freshness rules between explicit fixes and automatic recovery. */
export function assessSearchRecovery(receipt: SearchReceipt, checkId: string, attentionPolicy: unknown, originalPageUrl?: string | null,
  originalPages?: readonly string[], original?: SupportingObservation) {
  const policy = searchAttentionSchema.safeParse(attentionPolicy)
  if (!policy.success && attentionPolicy != null)
    return { comparable: false, verdict: 'unknown' as const, observationIds: receipt.observations.filter(item => item.checkId === checkId).map(item => item.id) }
  if (policy.success && policy.data.pageScopes) {
    const scopes = policy.data.pageScopes.filter(scope => normalizeVerifierUrl(scope.pageUrl) === normalizeVerifierUrl(receipt.pageUrl))
    if (!scopes.length) return { comparable: false, verdict: 'unknown' as const, observationIds: receipt.observations.filter(item => item.checkId === checkId).map(item => item.id) }
    const results = scopes.map(scope => assessScope(receipt, checkId, { ...policy.data, version: scope.version ?? policy.data.version, reason: scope.reason,
      sources: scope.sources, entityTypes: scope.entityTypes, google: scope.google, markupTargets: scope.markupTargets, resourceKeys: scope.resourceKeys }, original))
    const failures = results.filter(result => result.comparable && result.verdict === 'failed')
    const comparable = failures.length > 0 || results.every(result => result.comparable)
    return { comparable, verdict: failures.length ? 'failed' as const : comparable ? 'passed' as const : 'unknown' as const,
      observationIds: [...new Set((failures.length ? failures : results).flatMap(result => result.observationIds))] }
  }
  if (policy.success && originalPages && new Set(originalPages.map(normalizeVerifierUrl)).size > 1)
    return { comparable: false, verdict: 'unknown' as const, observationIds: receipt.observations.filter(item => item.checkId === checkId).map(item => item.id) }
  if (originalPageUrl && normalizeVerifierUrl(originalPageUrl) !== normalizeVerifierUrl(receipt.pageUrl))
    return { comparable: false, verdict: 'unknown' as const, observationIds: receipt.observations.filter(item => item.checkId === checkId).map(item => item.id) }
  return assessScope(receipt, checkId, attentionPolicy, original)
}

function assessScope(receipt: SearchReceipt, checkId: string, attentionPolicy: unknown, original?: SupportingObservation) {
  const policy = searchAttentionSchema.safeParse(attentionPolicy)
  const sources = policy.success ? policy.data.sources ?? [] : []
  const targets = policy.success ? policy.data.markupTargets ?? [] : []
  const matchesMarkup = (item: SearchObservation, target: typeof targets[number]) =>
    item.entityId === target.entityId && item.entityTypes?.includes(target.entityType) && item.source === target.source
  const canonical = checkId === 'search-canonical-target'
  const crawl = checkId === 'search-crawl-access'
  const checkVersion = policy.success ? policy.data.version : 1
  // Older sitemap syntax checks can compare a real XML result at the same
  // address. Newly recognized formats cannot certify an old syntax verdict.
  const matchesVersion = (item: SearchObservation) => item.checkVersion === checkVersion ||
    checkId === 'search-sitemap-invalid' && checkVersion <= 2 && item.checkVersion === SITEMAP_SYNTAX_VERSION &&
    (item.disposition === 'failed' || item.reason === 'sitemap_parsed')
  const storedKeys = policy.success ? policy.data.resourceKeys : undefined
  const resources = storedKeys ?? (canonical && checkVersion === 5 && original?.pageUrl &&
    normalizeVerifierUrl(original.pageUrl) === normalizeVerifierUrl(receipt.pageUrl) ? legacyCanonicalFlagKeys(original) : undefined) ?? []
  const resourceSource = canonical ? 'http' : crawl && resources.length ? 'robots-txt'
    : checkId === 'sitemap-missing' || checkId === 'search-sitemap-invalid' ? 'sitemap' : null
  // Nested and unrelated entities have their own observations. Repair concerns
  // every recorded failing entity, type, source and property on this page.
  const scoped = receipt.observations.filter(item => item.checkId === checkId && (!sources.length || sources.includes(item.source)) &&
    (!resourceSource || item.source === resourceSource) && (!targets.length || targets.some(target => matchesMarkup(item, target))) &&
    (!crawl || resources.length > 0 || !item.resourceKey || item.id === 'search-crawl-access:robots-txt'))
  const qualified = canonical ? scoped.map(item => item.resourceKey ? item : { ...item, resourceKey: legacyCanonicalObservationKey(item) }) : scoped
  const observations = resources.length ? qualified.filter(item => item.resourceKey && resources.includes(item.resourceKey)) : qualified
  if (resourceSource && resources.length) {
    // A measured failure of an original resource disproves repair independently.
    // A passing verdict below still requires the complete original inventory.
    const failures = observations.filter(item => matchesVersion(item) && item.disposition === 'failed')
    if (failures.length) return { comparable: true, verdict: 'failed' as const, observationIds: failures.map(item => item.id) }
  }
  const expectedTypes = policy.success ? policy.data.entityTypes ?? [] : []
  const typesObserved = new Set(observations.flatMap(item => item.entityTypes ?? []))
  const comparable = observations.length > 0 && !receipt.observations.some(item => item.reason === 'observation_limit') &&
    (!resourceSource || resources.length > 0) && resources.every(key => observations.some(item => item.resourceKey === key)) &&
    (checkId !== 'search-structured-feature' || targets.length > 0) &&
    observations.every(matchesVersion) &&
    observations.every(item => item.disposition !== 'unknown' && item.disposition !== 'not_applicable') &&
    targets.every(target => observations.some(item => matchesMarkup(item, target) && item.invalidProperties !== undefined)) &&
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
  // A matching entity can publish several property chunks. Every chunk can
  // disprove repair, and only an original invalid property counts as failure.
  const originalInvalid = (item: SearchObservation) =>
    targets.some(target => matchesMarkup(item, target) && target.properties.some(property => item.invalidProperties?.includes(property)))
  const failed = observations.some(item => item.disposition === 'failed' && (checkId !== 'search-structured-feature' || originalInvalid(item)))
  const markupIncomplete = targets.length > 0 && receipt.observations.some(item =>
    item.checkId === 'search-structured-coverage' && item.disposition === 'unknown' && targets.some(target => target.source === item.source))
  // Historical receipts keep their original interpretation. A fresh property
  // comparison requires affirmative evidence for every original source.
  const recordsValidation = observations.some(item => item.validatedProperties !== undefined)
  const propertiesValidated = checkId !== 'search-structured-feature' || !recordsValidation || targets.every(target =>
    target.properties.every(property => observations.some(item => matchesMarkup(item, target) && item.validatedProperties?.includes(property))))
  const passed = targets.length ? !markupIncomplete && !observations.some(originalInvalid) && propertiesValidated
    : observations.every(item => item.disposition === 'passed') || verifiedConflictRemoval
  const verdict = !comparable || !googleComparable ? 'unknown' : failed ? 'failed' : passed ? 'passed' : 'unknown'
  return { comparable: comparable && verdict !== 'unknown', verdict, observationIds: observations.map(item => item.id) }
}
