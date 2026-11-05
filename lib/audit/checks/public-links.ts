import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { openCheckDestinations, deadDestinationFlags, hasSuccessfulPublicGet, type OpenCheckObservation } from '../open-check'
import { collectEligibleDestinations } from '../url-identity'
import { destinationContext, publicLinkContext, displayDestination, originalDestinationContexts, PUBLIC_LINK_VERIFICATION_RULE } from './destination-evidence'
import type { PageMetadata } from '../metadata'
import { load } from 'cheerio'
import type { RenderedSearchSnapshot } from '../search/rendered-snapshot'
import type { DestinationCheckOptions } from './destination-evidence'
import { documentEvidenceWithheld } from '../browser/document-evidence'

export type PageLinkInventory = Pick<PageMetadata, 'links' | 'linkBaseUrl' | 'documentUrl'> & { complete?: boolean }
type LinkCapture = {
  renderedSearchSnapshot?: { finalUrl?: string | null; documentBaseUrl?: string | null; sections: Pick<RenderedSearchSnapshot['sections'], 'links'> } | null
  collectionRestrictions?: readonly string[] | null
}

/** Reuse the bounded native link section, independently of whole-page parsing.
 * Complete parsed metadata from the same capture can cover an exhausted section.
 * Historical sections without an observed base cannot resolve relative links. */
export function capturedPageLinks(capture: LinkCapture | null | undefined, metadata: PageMetadata | null,
  options: { requireLabels?: boolean } = {}): PageLinkInventory | null {
  const snapshot = capture?.renderedSearchSnapshot
  const restricted = documentEvidenceWithheld(capture?.collectionRestrictions)
  // Action classification consumes labels as well as hrefs. A restricted
  // document cannot authorize new destination probes from its link list.
  if (options.requireLabels && restricted) return null
  if (snapshot?.documentBaseUrl && (snapshot.sections.links.complete && (!options.requireLabels || snapshot.sections.links.labelsComplete === true) || !metadata)) {
    const section = snapshot.sections.links, $ = load(section.html)
    const anchors = $('a[href]').toArray()
    return { linkBaseUrl: snapshot.documentBaseUrl,
      documentUrl: snapshot.finalUrl ?? metadata?.documentUrl,
      links: anchors.slice(0, 2000).map(anchor => ({ href: $(anchor).attr('href') ?? '',
        // A clipped word can look like a complete action label. Other anchors
        // and href-based classification remain independently usable.
        text: options.requireLabels && (section.labelsComplete === undefined || $(anchor).is('[data-label-truncated]')) ? '' : $(anchor).text().trim(), rel: null })),
      complete: section.complete && !restricted && anchors.length <= 2000 && anchors.length === section.observed &&
        (!options.requireLabels || section.labelsComplete === true) }
  }
  return metadata ? { links: metadata.links, documentUrl: snapshot?.finalUrl ?? metadata.documentUrl,
    linkBaseUrl: snapshot?.documentBaseUrl ?? metadata.linkBaseUrl, complete: !restricted } : null
}

export const PUBLIC_LINK_LIMITATION = 'Public link GET responses cover the recorded destination inventory. Access restrictions, transport failures, untested links and interactive behavior remain unknown.'
export const PUBLIC_LINK_INVENTORY_LIMITATION = 'The captured link list was not collected. Public destinations remain unknown.'
const PUBLIC_DESTINATION_EXPECTED = 'The linked public destination responds without a missing-page or server error'

/** A capture without a link list cannot name a destination, broken or healthy. */
export function missingPublicLinkEvidence() {
  return { flags: [] as DeterministicFlag[], complete: false as const, limitation: PUBLIC_LINK_INVENTORY_LIMITATION,
    assertions: [{ key: 'public-destination', name: 'Public link response', expected: PUBLIC_DESTINATION_EXPECTED,
      observed: PUBLIC_LINK_INVENTORY_LIMITATION, passed: false, complete: false }] }
}

/** Detection and recovery consume the same observed GET, without another fetch.
 * A missing destination assertion cannot certify a removed or changed link. */
export function publicLinkObservations(sourceUrl: string, urls: string[], results: readonly OpenCheckObservation[], inventoryComplete = true) {
  const byDestination = new Map(results.map(result => [destinationContext(sourceUrl, result.url), result]))
  const observed: OpenCheckObservation[] = []
  const assertions: CheckAssertion[] = []
  let complete = inventoryComplete && urls.length <= 120
  for (const url of urls.slice(0, 120)) {
    const result = byDestination.get(destinationContext(sourceUrl, url))
    const passed = hasSuccessfulPublicGet(result)
    const conclusive = passed || result?.shouldFlagDead === true
    if (!conclusive) complete = false
    if (result) observed.push(result)
    assertions.push({ key: 'public-destination', name: 'Public link response',
      expected: PUBLIC_DESTINATION_EXPECTED,
      observed: `${displayDestination(url)}: ${result ? result.status === null ? result.outcome : `GET HTTP ${result.status} (${result.outcome})` : 'not checked'}. Interactive behavior was not tested.`,
      passed, complete: conclusive, context: publicLinkContext(sourceUrl, url) })
  }
  const flags: DeterministicFlag[] = deadDestinationFlags(observed, sourceUrl)
  return { flags, assertions, complete, limitation: inventoryComplete ? PUBLIC_LINK_LIMITATION
    : 'The captured link inventory is incomplete. ' + PUBLIC_LINK_LIMITATION }
}

type PublicLinkSource = { pageUrl: string | null; verificationRule: string | null; evidenceTargets: unknown; supportingObservations?: unknown }

/** Use each original page's observations, rather than a grouped display Flag's
 * representative page, to select comparable response work. */
export function originalPublicLinkContexts(sources: PublicLinkSource[], pageUrl: string): string[] {
  return originalDestinationContexts(sources, pageUrl, PUBLIC_LINK_VERIFICATION_RULE)
}

/** Targeted repair shares discovery's collector, but unrelated new links cannot
 * consume the budget needed to observe the immutable original repair scope. */
export async function checkPublicLinks(sourceUrl: string, inventory: PageLinkInventory, deadline: number,
  openDestination?: DestinationCheckOptions['openDestination'], originalContexts?: readonly string[]) {
  const expected = originalContexts ? new Set(originalContexts) : null
  const urls = publicLinkUrls(sourceUrl, inventory).filter(url => !expected || expected.has(publicLinkContext(sourceUrl, url)))
  const opened = await openCheckDestinations(urls, { origin: sourceUrl, ceiling: 120, deadline: Math.min(deadline, Date.now() + 8000), openDestination })
  const checked = publicLinkObservations(sourceUrl, urls, opened.results, inventory.complete !== false)
  const present = new Set(urls.map(url => publicLinkContext(sourceUrl, url)))
  const missing = [...(expected ?? [])].filter(context => !present.has(context))
  if (!missing.length) return checked
  const limitation = 'An originally failed public destination was not observed in the current captured link inventory. Removed or changed links cannot establish recovery.'
  return { ...checked, complete: false, limitation, assertions: [...checked.assertions, ...missing.map(context => ({
    key: 'public-destination', name: 'Public link response', expected: PUBLIC_DESTINATION_EXPECTED,
    observed: limitation, passed: false, complete: false, context,
  }))] }
}

export function resolvedPageLinks(sourceUrl: string, metadata: PageLinkInventory) {
  const documentUrl = metadata.documentUrl ?? sourceUrl
  const document = URL.canParse(documentUrl) ? new URL(documentUrl) : null
  return metadata.links.map(link => {
    // A fragment reference can leave this document when its observed base differs.
    try {
      const destination = new URL(link.href, metadata.linkBaseUrl ?? sourceUrl)
      if (document && destination.hash && destination.origin === document.origin && destination.pathname === document.pathname && destination.search === document.search)
        return { ...link, href: '' }
      return { ...link, href: destination.href }
    }
    catch { return { ...link, href: '' } }
  })
}

export function publicLinkUrls(sourceUrl: string, metadata: PageLinkInventory) {
  return collectEligibleDestinations(sourceUrl, resolvedPageLinks(sourceUrl, metadata), 'request').map(link => link.href)
}
