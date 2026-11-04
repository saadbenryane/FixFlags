import { z } from 'zod'
import { planOpenCheckDestinations, type OpenCheckObservation } from '../open-check'
import { missingPublicLinkEvidence, publicLinkObservations, publicLinkUrls, type PageLinkInventory } from '../checks/public-links'
import { checkReceiptSchema } from '../checks/receipt'
import { publicLinkContext, PUBLIC_LINK_VERIFICATION_RULE } from '../checks/destination-evidence'
import { recordedMatchingContexts } from '../recorded-targets'

export const DISCOVERY_BATCH_SIZE = 6
const inventorySchema = z.object({ pageUrl: z.string().url(), urls: z.array(z.string().url()).max(120),
  complete: z.boolean(), missing: z.boolean() }).strict()
export const discoveryMemberSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inventory'), sources: z.array(inventorySchema).max(24) }).strict(),
  z.object({ kind: z.literal('destination'), url: z.string().url(), sources: z.array(z.string().url()).max(24) }).strict(),
])
export type DiscoveryMember = z.infer<typeof discoveryMemberSchema>

/** One shared GET can serve several source pages. Inventory limits remain
 * explicit observations, separately from destinations owned by later batches. */
export function planDiscoveryObservations(input: {
  origin: string; urls: string[]; ceiling: number;
  sources: Array<{ url: string; navigation?: PageLinkInventory | null }>;
  retainedContexts?: ReadonlySet<string>;
}) {
  const sources = input.sources.map(source => {
    const urls = source.navigation ? publicLinkUrls(source.url, source.navigation) : []
    return { pageUrl: source.url, urls, missing: !source.navigation,
      complete: source.navigation?.complete !== false && Boolean(source.navigation) && urls.length <= 120 }
  })
  // Historical contexts can reserve budget only for declarations observed on
  // this execution's source page. Removed or changed URLs gain no fetch authority.
  const admitted = new Set(input.urls)
  const retained = new Set(sources.flatMap(source => source.urls.filter(url => admitted.has(url) && input.retainedContexts?.has(publicLinkContext(source.pageUrl, url)))))
  const planned = planOpenCheckDestinations([...retained, ...input.urls], input)
  const selected = new Set(planned.urls)
  // Every selected response must retain its source ownership before inventory
  // truncation. Important fresh destinations can appear late in the document.
  const inventories = sources.map(source => ({ ...source,
    urls: [...source.urls.filter(url => selected.has(url)), ...source.urls.filter(url => !selected.has(url))].slice(0, 120) }))
  const members: DiscoveryMember[] = [{ kind: 'inventory', sources: inventories.map(source => ({ ...source,
    urls: source.urls.filter(url => !selected.has(url)) })) },
  ...planned.urls.map(url => ({ kind: 'destination' as const, url,
    sources: inventories.filter(source => source.urls.includes(url)).map(source => source.pageUrl) }))]
  return { members, truncated: planned.truncated || input.sources.some(source => source.navigation?.complete !== true) ||
    inventories.some(source => !source.complete || source.urls.some(url => !selected.has(url))) }
}

/** Reuse historical responsibility without transferring whole Flags or keeping
 * a second registry. Only current matching contexts survive the bounded stream. */
export async function planRecordedDiscoveryObservations(input: Parameters<typeof planDiscoveryObservations>[0],
  history?: { projectId: string; environment: string; excludeAuditId: string }) {
  if (!history) return planDiscoveryObservations(input)
  const candidates = new Set(input.sources.flatMap(source => source.navigation
    ? publicLinkUrls(source.url, source.navigation).map(url => publicLinkContext(source.url, url)) : []))
  const retainedContexts = await recordedMatchingContexts({ ...history, verificationRule: PUBLIC_LINK_VERIFICATION_RULE }, candidates)
  return planDiscoveryObservations({ ...input, retainedContexts })
}

/** A batch only judges its owned destinations. Not-yet-run peers do not leave
 * stale unknown assertions after their independent observations later complete. */
export function discoveryObservations(members: readonly DiscoveryMember[], results: readonly OpenCheckObservation[],
  execution: { auditId: string; taskId: string; collectedAt: string }) {
  const pages = new Map<string, { urls: Set<string>; complete: boolean; missing: boolean }>()
  const page = (url: string) => {
    if (!pages.has(url)) pages.set(url, { urls: new Set(), complete: true, missing: false })
    return pages.get(url)!
  }
  for (const member of members) {
    if (member.kind === 'inventory') for (const source of member.sources) {
      const owned = page(source.pageUrl)
      source.urls.forEach(url => owned.urls.add(url))
      owned.complete &&= source.complete
      owned.missing ||= source.missing
    }
    else for (const source of member.sources) page(source).urls.add(member.url)
  }
  return [...pages].map(([pageUrl, owned]) => {
    const checked = owned.missing ? missingPublicLinkEvidence()
      : publicLinkObservations(pageUrl, [...owned.urls], results, owned.complete)
    return { ...checked, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', pageUrl,
      applicable: true, passed: checked.complete && checked.flags.length === 0,
      assertions: checked.assertions, complete: checked.complete, limitation: checked.limitation,
      execution: { ...execution, checkVersion: 1, source: 'http' } }) }
  })
}
