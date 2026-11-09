import { z } from 'zod'
import { hasSuccessfulPublicGet, OPEN_CHECK_OUTCOMES, planOpenCheckDestinations, type OpenCheckObservation } from '../open-check'
import { missingPublicLinkEvidence, publicLinkObservations, publicLinkUrls, type PageLinkInventory } from '../checks/public-links'
import { checkReceiptSchema } from '../checks/receipt'
import { publicLinkContext, PUBLIC_LINK_VERIFICATION_RULE } from '../checks/destination-evidence'
import { recordedMatchingContexts } from '../recorded-targets'
import { capturePageKey } from '../browser/observation-scope'
import { prisma } from '@/lib/db'
import { OBSERVATION_TARGET } from './observation-progress'

export const DISCOVERY_BATCH_SIZE = 6
const MAX_DESTINATIONS_PER_SOURCE = 120
const discoveryResultSchema = z.object({ outcome: z.enum(OPEN_CHECK_OUTCOMES), status: z.number().int().min(100).max(599).nullable(),
  shouldFlagDead: z.boolean() }).strict()
const reusableDiscoveryResult = discoveryResultSchema.refine(result => hasSuccessfulPublicGet(result) || result.shouldFlagDead && result.status !== null &&
  ['not_found', 'server_error', 'redirect_loop', 'render_error'].includes(result.outcome))
export const discoveryResponsesSchema = z.array(z.object({ key: z.string().regex(/^[a-f0-9]{64}:(routine|extended)$/),
  result: reusableDiscoveryResult }).strict()).max(DISCOVERY_BATCH_SIZE)
const reuseSchema = z.object({ taskId: z.string().min(1), collectedAt: z.string().datetime(), result: reusableDiscoveryResult }).strict()
type ReusedResponse = z.infer<typeof reuseSchema>
function responseKey(url: string, extendedBody: boolean) { return capturePageKey(url) + (extendedBody ? ':extended' : ':routine') }

export function discoveryResponses(results: readonly OpenCheckObservation[], extendedBody: ReadonlySet<string>) {
  return results.flatMap(({ url, outcome, status, shouldFlagDead }) => {
    const parsed = reusableDiscoveryResult.safeParse({ outcome, status, shouldFlagDead })
    return parsed.success ? [{ key: responseKey(url, extendedBody.has(url)), result: parsed.data }] : []
  })
}

/** Read only the first pass's committed response facts. Batched work is owned
 * by its journal receipts, while a small unbatched pass owns its task result. */
export async function previousDiscoveryResponses(auditId: string, pageUrl: string) {
  const rows = await prisma.$queryRaw<Array<{ taskId: string; collectedAt: unknown; responses: unknown }>>`
    WITH first AS MATERIALIZED (
      SELECT id, "workResult" FROM audit_execution_tasks
      WHERE "auditId" = ${auditId} AND "targetKey" = 'task:discovery' AND "workKind" = 'discovery'
        AND "pageUrl" = ${pageUrl} AND "workState" IN ('COMPLETED', 'EXHAUSTED', 'BLOCKED')
    )
    SELECT first.id AS "taskId", r.detail#>>'{data,responseCollectedAt}' AS "collectedAt", r.detail#>'{data,responses}' AS responses
    FROM first JOIN audit_verifier_executions r ON r."taskId" = first.id
    WHERE r."auditId" = ${auditId} AND r."pageUrl" = ${pageUrl} AND r."targetKey" = ${OBSERVATION_TARGET}
      AND r.status = 'COMPLETED' AND r.detail->>'kind' = 'discovery' AND r.detail->'version' = '1'::jsonb
    UNION ALL
    SELECT id, "workResult"#>>'{data,responseCollectedAt}', "workResult"#>'{data,responses}' FROM first
    WHERE "workResult"->>'kind' = 'discovery' AND "workResult"->'version' = '1'::jsonb
      AND NOT ("workResult"->'data' ? 'observationProgress')
    LIMIT 121`
  const reusable = new Map<string, ReusedResponse>()
  const duplicated = new Set<string>()
  for (const row of rows) {
    const responses = discoveryResponsesSchema.safeParse(row.responses)
    if (!responses.success) continue
    for (const { key, result } of responses.data) {
      const parsed = reuseSchema.safeParse({ taskId: row.taskId, collectedAt: row.collectedAt, result })
      if (!parsed.success || duplicated.has(key)) continue
      if (reusable.delete(key)) duplicated.add(key)
      else reusable.set(key, parsed.data)
    }
  }
  return reusable
}
const inventorySchema = z.object({ pageUrl: z.string().url(), urls: z.array(z.string().url()).max(MAX_DESTINATIONS_PER_SOURCE),
  complete: z.boolean(), missing: z.boolean() }).strict()
export const discoveryMemberSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('inventory'), sources: z.array(inventorySchema).max(24) }).strict(),
  z.object({ kind: z.literal('destination'), url: z.string().url(), sources: z.array(z.string().url()).max(24),
    extendedBody: z.literal(true).optional(), reused: reuseSchema.optional() }).strict(),
])
export type DiscoveryMember = z.infer<typeof discoveryMemberSchema>

/** One shared GET can serve several source pages. Inventory limits remain
 * explicit observations, separately from destinations owned by later batches. */
export function planDiscoveryObservations(input: {
  origin: string; urls: string[]; ceiling: number;
  sources: Array<{ url: string; navigation?: PageLinkInventory | null }>;
  retainedContexts?: ReadonlySet<string>;
  previousResponses?: ReadonlyMap<string, ReusedResponse>;
}) {
  const sources = input.sources.map(source => {
    const urls = source.navigation ? publicLinkUrls(source.url, source.navigation) : []
    return { pageUrl: source.url, urls, selected: new Set<string>(), missing: !source.navigation,
      complete: source.navigation?.complete !== false && Boolean(source.navigation) && urls.length <= MAX_DESTINATIONS_PER_SOURCE }
  })
  // Historical contexts can reserve budget only for declarations observed on
  // this execution's source page. Removed or changed URLs gain no fetch authority.
  const admitted = new Set(input.urls)
  const retained = new Set(sources.flatMap(source => source.urls.filter(url => admitted.has(url) && input.retainedContexts?.has(publicLinkContext(source.pageUrl, url)))))
  const declaringPages = new Map<string, typeof sources>()
  for (const source of sources) for (const url of source.urls) {
    const pages = declaringPages.get(url)
    if (pages) pages.push(source)
    else declaringPages.set(url, [source])
  }
  // Apply the request ceiling after matching source ownership and reusable evidence.
  const candidates = planOpenCheckDestinations([...retained, ...input.urls], { origin: input.origin, ceiling: Infinity }).urls
  const destinations: DiscoveryMember[] = []
  let freshRequests = 0
  for (const url of candidates) {
    const pages = declaringPages.get(url)?.filter(source => source.selected.size < MAX_DESTINATIONS_PER_SOURCE)
    if (!pages?.length) continue
    const extendedBody = retained.has(url)
    const reused = input.previousResponses?.get(responseKey(url, extendedBody))
    if (!reused && freshRequests >= input.ceiling) continue
    if (!reused) freshRequests++
    for (const page of pages) page.selected.add(url)
    destinations.push({ kind: 'destination', url, sources: pages.map(source => source.pageUrl),
      ...(extendedBody ? { extendedBody: true } : {}), ...(reused ? { reused } : {}) })
  }
  const members: DiscoveryMember[] = [{ kind: 'inventory', sources: sources.map(({ pageUrl, urls, selected, complete, missing }) => ({
    pageUrl, complete, missing, urls: urls.filter(url => !selected.has(url)).slice(0, MAX_DESTINATIONS_PER_SOURCE - selected.size),
  })) }, ...destinations]
  return { members, truncated: input.sources.some(source => source.navigation?.complete !== true) ||
    sources.some(source => !source.complete || source.selected.size < source.urls.length) }
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
  const pages = new Map<string, { urls: Set<string>; complete: boolean; missing: boolean; collectedAt: string }>()
  const page = (url: string) => {
    if (!pages.has(url)) pages.set(url, { urls: new Set(), complete: true, missing: false, collectedAt: execution.collectedAt })
    return pages.get(url)!
  }
  for (const member of members) {
    if (member.kind === 'inventory') for (const source of member.sources) {
      const owned = page(source.pageUrl)
      source.urls.forEach(url => owned.urls.add(url))
      owned.complete &&= source.complete
      owned.missing ||= source.missing
    }
    else for (const source of member.sources) {
      const owned = page(source)
      owned.urls.add(member.url)
      if (member.reused && Date.parse(member.reused.collectedAt) < Date.parse(owned.collectedAt)) owned.collectedAt = member.reused.collectedAt
    }
  }
  const combined = [...results, ...members.flatMap(member => member.kind === 'destination' && member.reused
    ? [{ url: member.url, ...member.reused.result }] : [])]
  return [...pages].map(([pageUrl, owned]) => {
    const checked = owned.missing ? missingPublicLinkEvidence()
      : publicLinkObservations(pageUrl, [...owned.urls], combined, owned.complete)
    return { ...checked, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'seo', pageUrl,
      applicable: true, passed: checked.complete && checked.flags.length === 0,
      assertions: checked.assertions, complete: checked.complete, limitation: checked.limitation,
      publicLinkInventoryComplete: owned.complete && !owned.missing,
      execution: { ...execution, collectedAt: owned.collectedAt, checkVersion: 1, source: 'http' } }) }
  })
}
