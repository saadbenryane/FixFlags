import { PageMetadata } from './metadata'
import {
  CATEGORY_MAX,
  classifyLinkCategory,
  resolveSameOrigin,
  scoreCtaLink,
  type LinkCategory,
} from './flow/link-scoring'

const MAX_URLS = 6

export interface DiscoveredPage {
  url: string
  category: LinkCategory
}

/**
 * Discover up to 6 same-origin URLs along the conversion corridor:
 * primary + pricing + CTA destination + features + trust + resources.
 *
 * Category diversity is enforced: at most CATEGORY_MAX pages per link category.
 */
export function discoverCriticalPathUrls(
  primaryUrl: string,
  metadata: PageMetadata
): DiscoveredPage[] {
  const origin = new URL(primaryUrl).origin
  const ordered: DiscoveredPage[] = [{ url: primaryUrl, category: 'primary' as LinkCategory }]
  const seen = new Set<string>([primaryUrl])
  const categoryCounts = new Map<LinkCategory, number>()

  const ranked = metadata.links
    .map((link) => {
      const resolved = resolveSameOrigin(origin, link.href)
      if (!resolved || seen.has(resolved)) return null
      const score = scoreCtaLink(link.href, link.text)
      if (score === 0) return null
      const category = classifyLinkCategory(link.href, link.text)
      return { url: resolved, score, category }
    })
    .filter((x): x is { url: string; score: number; category: LinkCategory } => x !== null)
    .sort((a, b) => b.score - a.score)

  for (const { url, category } of ranked) {
    if (ordered.length >= MAX_URLS) break
    const used = categoryCounts.get(category) ?? 0
    if (used >= (CATEGORY_MAX[category] ?? 1)) continue
    categoryCounts.set(category, used + 1)
    seen.add(url)
    ordered.push({ url, category })
  }

  return ordered
}
