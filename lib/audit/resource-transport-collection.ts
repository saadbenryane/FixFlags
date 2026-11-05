import type { PageMetadata } from './metadata'
import type { PublicDocument } from './search/contracts'
import { parseResourceTransportIsolated } from './progressive/cpu'
import { ExecutionOwnershipLost } from './execution-ownership'

/** Reuse existing declarations, or inspect the same complete public response.
 * Unrelated metadata inventories cannot gate this bounded resource observation. */
export async function collectResourceTransportEvidence(pageUrl: string, metadata: Pick<PageMetadata, 'resourceTransport'> | null,
  document: PublicDocument | undefined, deadline: number) {
  if (metadata?.resourceTransport || !document || new URL(document.url).href !== new URL(pageUrl).href ||
    !document.complete || document.reason || document.transportFailure || document.status === null || document.status < 200 || document.status >= 300 ||
    new URL(document.finalUrl).protocol !== 'https:' ||
    !document.body || !/(?:text\/html|application\/xhtml\+xml)/i.test(document.headers['content-type'] ?? '')) return undefined
  try {
    return await parseResourceTransportIsolated(document.body, document.finalUrl, Math.min(deadline - 500, Date.now() + 5_000))
  } catch (error) {
    if (error instanceof ExecutionOwnershipLost) throw error
    // TLS and response facts retain their authority when resource parsing is unavailable.
    return undefined
  }
}
