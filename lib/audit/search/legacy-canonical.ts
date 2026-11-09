import type { SupportingObservation } from '../flag-observations'
import { isSuccessfulPublicGetStatus } from '../http-evidence'
import { searchAttentionSchema, type SearchObservation } from './contracts'
import { searchResourceKey } from './resource-identity'

function isCanonicalUrl(value: string) {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.hash && url.href === value
  } catch { return false }
}

function missingStatus(status: number) {
  return status >= 400 && status < 500 && status !== 429
}

/** Original v5 findings retained the complete requested URL and status for
 * each failing target, with a source prefix when there was more than one. */
export function legacyCanonicalFlagKeys(original: SupportingObservation | undefined) {
  if (!original || original.source !== 'DETERMINISTIC' || !original.provenance?.collectedAt ||
    !original.checkVersion || original.checkId?.split('::page:')[0] !== 'search-canonical-target') return undefined
  const policy = searchAttentionSchema.safeParse(original.attentionPolicy)
  if (!policy.success || policy.data.version !== 5 || policy.data.kind !== 'flag' ||
    policy.data.reason !== 'canonical_target_broken' || policy.data.sources?.join() !== 'http') return undefined
  const lines = original.evidence.split('\n', 5)
  if (lines.length > 4) return undefined
  const keys = new Set<string>()
  for (const line of lines) {
    const response = lines.length === 1 ? line : line.startsWith('http: ') ? line.slice(6) : ''
    const match = /^(https?:\/\/\S+): HTTP (\d{3})$/.exec(response)
    if (!match || !missingStatus(Number(match[2])) || !isCanonicalUrl(match[1])) return undefined
    keys.add(searchResourceKey(match[1]))
  }
  return [...keys]
}

/** Older receipts have an exact requested URL in the observation ID. The
 * recorded response must still satisfy the current status requirements. */
export function legacyCanonicalObservationKey(item: SearchObservation) {
  const prefix = 'search-canonical-target:'
  if (item.checkVersion !== 5 || item.source !== 'http' || !item.id.startsWith(prefix)) return undefined
  const url = item.id.slice(prefix.length)
  const responsePrefix = url + ': HTTP '
  if (!isCanonicalUrl(url) || !item.observed.startsWith(responsePrefix)) return undefined
  const status = item.observed.slice(responsePrefix.length)
  if (!/^\d{3}$/.test(status)) return undefined
  if (item.disposition === 'passed' && item.reason === 'canonical_target_reachable' && isSuccessfulPublicGetStatus(Number(status)) ||
    item.disposition === 'failed' && item.reason === 'canonical_target_broken' && missingStatus(Number(status))) return searchResourceKey(url)
  return undefined
}
