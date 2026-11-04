import { createHash } from 'node:crypto'
import { AGENT_HANDOFF_COPY as C } from '@/lib/marketing/copy/agent-handoff'
import { SiteRunRefusal } from './application/run-refusal'
import { repairBriefFragmentSchema, repairDocumentOffsetSchema, type RepairBrief } from './repair-brief-contract'
import { MAX_REPAIR_BRIEF_BYTES } from './repair-budgets'

/** One bounded transport for HTTP and MCP. Fragment the validated public DTO,
 * never the stored Flag or private comparison inputs. No persistence or cache
 * is needed: both context and exact document revision fence each continuation. */
export function deliverSiteRepairBrief(brief: RepairBrief, options: { documentOffset?: number; expectedDocumentHash?: string } = {}, maxBytes = MAX_REPAIR_BRIEF_BYTES) {
  const offset = options.documentOffset ?? 0
  if (!repairDocumentOffsetSchema.safeParse(offset).success || offset > 0 && !options.expectedDocumentHash)
    throw new SiteRunRefusal(C.invalidDocumentContinuation, 400, 'INVALID_REPAIR_DOCUMENT_PAGE')
  const bytes = Buffer.from(JSON.stringify(brief))
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (options.expectedDocumentHash && options.expectedDocumentHash !== sha256)
    throw new SiteRunRefusal(C.documentChanged, 409, 'REPAIR_DOCUMENT_CHANGED')
  if (offset >= bytes.length || (bytes[offset] & 0xc0) === 0x80)
    throw new SiteRunRefusal(C.invalidDocumentContinuation, 400, 'INVALID_REPAIR_DOCUMENT_PAGE')
  if (bytes.length <= maxBytes) {
    if (offset) throw new SiteRunRefusal(C.invalidDocumentContinuation, 400, 'INVALID_REPAIR_DOCUMENT_PAGE')
    return brief
  }
  const url = (start: number) => {
    const result = new URL(brief.links.json)
    result.searchParams.set('documentOffset', String(start))
    result.searchParams.set('documentHash', sha256)
    if (brief.evidence) result.searchParams.set('includeEvidence', 'true')
    return result.href
  }
  const request = (start: number) => ({ ...brief.retrieval.mcp, arguments: { ...brief.retrieval.mcp.arguments,
    documentOffset: start, expectedDocumentHash: sha256, ...(brief.evidence ? { includeEvidence: true } : {}) } })
  let length = Math.min(128 * 1024, bytes.length - offset)
  for (;;) {
    let end = offset + length
    // UTF-8 fragments remain readable and concatenate without replacement bytes.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--
    const nextOffset = end < bytes.length ? end : null
    const fragment = repairBriefFragmentSchema.parse({
      schemaVersion: 'fixflags.repair-brief-fragment.v1',
      siteId: brief.siteId, referenceFlagId: brief.referenceFlagId, contextHash: brief.contextHash,
      observationPage: brief.observationPage,
      document: { schemaVersion: brief.schemaVersion, encoding: 'utf8-json', sha256, totalBytes: bytes.length,
        offset, returnedBytes: end - offset, text: bytes.subarray(offset, end).toString('utf8'), nextOffset },
      instructions: [C.documentRetrieval],
      links: { ...brief.links, json: url(offset), next: nextOffset === null ? brief.links.next : url(nextOffset) },
      retrieval: { ...brief.retrieval, mcp: request(offset), next: nextOffset === null ? brief.retrieval.next : request(nextOffset) },
    })
    if (Buffer.byteLength(JSON.stringify(fragment)) <= maxBytes && end > offset) return fragment
    length = Math.floor(length / 2)
    if (length < 4) throw new Error('Repair delivery metadata exceeds its transport budget')
  }
}
