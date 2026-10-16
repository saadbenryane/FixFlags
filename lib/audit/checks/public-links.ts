import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { openCheckDestinations, deadDestinationFlags, type OpenCheckResult } from '../open-check'
import { collectEligibleDestinations } from '../url-identity'
import { destinationContext, displayDestination } from './destination-evidence'
import type { PageMetadata } from '../metadata'
import { load } from 'cheerio'
import type { RenderedSearchSnapshot } from '../search/rendered-snapshot'

export type PageLinkInventory = Pick<PageMetadata, 'links' | 'linkBaseUrl'> & { complete?: boolean }
type LinkCapture = {
  renderedSearchSnapshot?: { documentBaseUrl?: string | null; sections: Pick<RenderedSearchSnapshot['sections'], 'links'> } | null
  collectionRestrictions?: readonly string[] | null
}

/** Reuse the bounded native link section, independently of whole-page parsing.
 * Complete parsed metadata from the same capture can cover an exhausted section.
 * Historical sections without an observed base cannot resolve relative links. */
export function capturedPageLinks(capture: LinkCapture | null | undefined, metadata: PageMetadata | null): PageLinkInventory | null {
  const snapshot = capture?.renderedSearchSnapshot
  const restricted = Boolean(capture?.collectionRestrictions?.length)
  if (snapshot?.documentBaseUrl && (snapshot.sections.links.complete || !metadata)) {
    const section = snapshot.sections.links, $ = load(section.html)
    const anchors = $('a[href]').toArray()
    return { linkBaseUrl: snapshot.documentBaseUrl,
      links: anchors.slice(0, 2000).map(anchor => ({ href: $(anchor).attr('href') ?? '', text: $(anchor).text().trim(), rel: null })),
      complete: section.complete && !restricted && anchors.length <= 2000 && anchors.length === section.observed }
  }
  return metadata ? { links: metadata.links, linkBaseUrl: snapshot?.documentBaseUrl ?? metadata.linkBaseUrl, complete: !restricted } : null
}

export const PUBLIC_LINK_LIMITATION = 'Public link GET responses cover the recorded destination inventory. Access restrictions, transport failures, untested links and interactive behavior remain unknown.'

/** Detection and recovery consume the same observed GET, without another fetch.
 * A missing destination assertion cannot certify a removed or changed link. */
export function publicLinkObservations(sourceUrl: string, urls: string[], results: OpenCheckResult[], inventoryComplete = true) {
  const byDestination = new Map(results.map(result => [destinationContext(sourceUrl, result.url), result]))
  const observed: OpenCheckResult[] = []
  const assertions: CheckAssertion[] = []
  let complete = inventoryComplete && urls.length <= 120
  for (const url of urls.slice(0, 120)) {
    const result = byDestination.get(destinationContext(sourceUrl, url))
    const passed = Boolean(result && !result.shouldFlagDead && result.outcome !== 'blocked' && result.status !== null && result.status >= 200 && result.status < 300)
    const conclusive = passed || result?.shouldFlagDead === true
    if (!conclusive) complete = false
    if (result) observed.push(result)
    assertions.push({ key: 'public-destination', name: 'Public link response',
      expected: 'The linked public destination responds without a missing-page or server error',
      observed: `${displayDestination(url)}: ${result ? result.status === null ? result.outcome : `GET HTTP ${result.status} (${result.outcome})` : 'not checked'}. Interactive behavior was not tested.`,
      passed, complete: conclusive, context: destinationContext(sourceUrl, url) })
  }
  const flags: DeterministicFlag[] = deadDestinationFlags(observed, sourceUrl)
  return { flags, assertions, complete, limitation: inventoryComplete ? PUBLIC_LINK_LIMITATION
    : 'The captured link inventory is incomplete. ' + PUBLIC_LINK_LIMITATION }
}

/** Targeted repair uses the same bounded public collector as Site discovery. */
export async function checkPublicLinks(sourceUrl: string, inventory: PageLinkInventory, deadline: number) {
  const urls = publicLinkUrls(sourceUrl, inventory)
  const opened = await openCheckDestinations(urls, { origin: sourceUrl, ceiling: 120, deadline: Math.min(deadline, Date.now() + 8000) })
  return publicLinkObservations(sourceUrl, urls, opened.results, inventory.complete !== false)
}

export function resolvedPageLinks(sourceUrl: string, metadata: PageLinkInventory) {
  return metadata.links.map(link => {
    if (link.href.startsWith('#')) return link
    try { return { ...link, href: new URL(link.href, metadata.linkBaseUrl ?? sourceUrl).href } }
    catch { return { ...link, href: '' } }
  })
}

export function publicLinkUrls(sourceUrl: string, metadata: PageLinkInventory) {
  return collectEligibleDestinations(sourceUrl, resolvedPageLinks(sourceUrl, metadata)).map(link => link.href)
}
