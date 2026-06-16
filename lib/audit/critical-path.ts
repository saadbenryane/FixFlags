import { PageMetadata } from './metadata'
import { resolveSameOrigin, scoreCtaLink } from './flow/link-scoring'

const MAX_URLS = 3

/** Up to 3 same-origin URLs: primary + pricing + primary CTA destination. */
export function discoverCriticalPathUrls(primaryUrl: string, metadata: PageMetadata): string[] {
  const origin = new URL(primaryUrl).origin
  const ordered = [primaryUrl]
  const seen = new Set<string>([primaryUrl])

  const ranked = metadata.links
    .map((link) => {
      const resolved = resolveSameOrigin(origin, link.href)
      if (!resolved || seen.has(resolved)) return null
      const score = scoreCtaLink(link.href, link.text)
      if (score === 0) return null
      return { url: resolved, score }
    })
    .filter((x): x is { url: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score)

  for (const { url } of ranked) {
    if (ordered.length >= MAX_URLS) break
    seen.add(url)
    ordered.push(url)
  }

  return ordered
}
