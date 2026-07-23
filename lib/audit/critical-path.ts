import { PageMetadata } from './metadata'
import {
  CATEGORY_MAX,
  classifyLinkCategory,
  resolveSameOrigin,
  scoreCtaLink,
  type LinkCategory,
} from './flow/link-scoring'
import type { ScanAccessConfig } from './scan-access'
import { scanAccessToFetchHeaders } from './scan-access'
import { logger } from '@/lib/logger'

const MAX_URLS = 6
const SITEMAP_TIMEOUT_MS = 4_000
const BFS_TIMEOUT_MS = 4_000

export interface DiscoveredPage {
  url: string
  category: LinkCategory
}

interface RankedLink {
  url: string
  score: number
  category: LinkCategory
}

function normalizeCandidateUrl(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    // Drop trailing slash except origin root
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    return u.toString()
  } catch {
    return url
  }
}

function rankLinksFromPairs(
  origin: string,
  links: Array<{ href: string; text: string }>,
  seen: Set<string>
): RankedLink[] {
  return links
    .map((link) => {
      const resolved = resolveSameOrigin(origin, link.href)
      if (!resolved) return null
      const normalized = normalizeCandidateUrl(resolved)
      if (seen.has(normalized)) return null
      const score = scoreCtaLink(link.href, link.text)
      if (score === 0) return null
      const category = classifyLinkCategory(link.href, link.text)
      return { url: normalized, score, category }
    })
    .filter((x): x is RankedLink => x !== null)
    .sort((a, b) => b.score - a.score)
}

function selectDiverse(
  primaryUrl: string,
  ranked: RankedLink[],
  maxUrls = MAX_URLS
): DiscoveredPage[] {
  const ordered: DiscoveredPage[] = [
    { url: normalizeCandidateUrl(primaryUrl), category: 'primary' as LinkCategory },
  ]
  const seen = new Set<string>([normalizeCandidateUrl(primaryUrl)])
  const categoryCounts = new Map<LinkCategory, number>()

  for (const { url, category } of ranked) {
    if (ordered.length >= maxUrls) break
    if (seen.has(url)) continue
    const used = categoryCounts.get(category) ?? 0
    if (used >= (CATEGORY_MAX[category] ?? 1)) continue
    categoryCounts.set(category, used + 1)
    seen.add(url)
    ordered.push({ url, category })
  }

  return ordered
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
  const seen = new Set<string>([normalizeCandidateUrl(primaryUrl)])
  const ranked = rankLinksFromPairs(origin, metadata.links, seen)
  return selectDiverse(primaryUrl, ranked)
}

async function fetchSitemapCandidates(
  origin: string,
  fetchHeaders?: Record<string, string>
): Promise<Array<{ href: string; text: string }>> {
  const sitemapUrl = new URL('/sitemap.xml', origin).toString()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SITEMAP_TIMEOUT_MS)
  try {
    const res = await fetch(sitemapUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/xml,text/xml,*/*',
        ...(fetchHeaders ?? {}),
      },
    })
    if (!res.ok) return []
    const body = await res.text()
    const locs = [...body.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim())
    return locs.slice(0, 40).map((href) => {
      let text = ''
      try {
        text = new URL(href).pathname.replace(/[-_/]/g, ' ').trim()
      } catch {
        text = href
      }
      return { href, text }
    })
  } catch (err) {
    logger.debug('Sitemap corridor enrich skipped', { err: String(err) })
    return []
  } finally {
    clearTimeout(timer)
  }
}

async function fetchPageLinkCandidates(
  pageUrl: string,
  origin: string,
  fetchHeaders?: Record<string, string>
): Promise<Array<{ href: string; text: string }>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), BFS_TIMEOUT_MS)
  try {
    const res = await fetch(pageUrl, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'text/html', ...(fetchHeaders ?? {}) },
    })
    if (!res.ok) return []
    const html = await res.text()
    const matches = [...html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    return matches.slice(0, 60).map((m) => {
      const href = m[1]
      const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
      const resolved = resolveSameOrigin(origin, href)
      return { href: resolved ?? href, text }
    })
  } catch (err) {
    logger.debug('BFS corridor enrich skipped', { pageUrl, err: String(err) })
    return []
  } finally {
    clearTimeout(timer)
  }
}

function missingPriorityCategories(pages: DiscoveredPage[]): boolean {
  const cats = new Set(pages.map((p) => p.category))
  return !cats.has('pricing') || !cats.has('primary-cta')
}

/**
 * Enrich corridor discovery with sitemap URLs and one-hop BFS when pricing/signup
 * are missing from homepage link metadata.
 */
export async function discoverCriticalPathUrlsEnriched(
  primaryUrl: string,
  metadata: PageMetadata,
  scanAccess?: ScanAccessConfig | null
): Promise<DiscoveredPage[]> {
  const fetchHeaders = scanAccessToFetchHeaders(scanAccess)
  let pages = discoverCriticalPathUrls(primaryUrl, metadata)
  if (!missingPriorityCategories(pages)) return pages

  const origin = new URL(primaryUrl).origin
  const seen = new Set(pages.map((p) => p.url))
  const extras: RankedLink[] = []

  const sitemapLinks = await fetchSitemapCandidates(origin, fetchHeaders)
  extras.push(...rankLinksFromPairs(origin, sitemapLinks, seen))

  // BFS depth 1: fetch the highest-scoring homepage link for more corridor links
  const seed = metadata.links
    .map((l) => {
      const resolved = resolveSameOrigin(origin, l.href)
      if (!resolved) return null
      return { url: normalizeCandidateUrl(resolved), score: scoreCtaLink(l.href, l.text) }
    })
    .filter((x): x is { url: string; score: number } => x !== null && x.score >= 70)
    .sort((a, b) => b.score - a.score)[0]

  if (seed && seed.url !== normalizeCandidateUrl(primaryUrl)) {
    const hopLinks = await fetchPageLinkCandidates(seed.url, origin, fetchHeaders)
    extras.push(...rankLinksFromPairs(origin, hopLinks, seen))
  }

  if (extras.length === 0) return pages

  const homepageRanked = rankLinksFromPairs(origin, metadata.links, new Set([normalizeCandidateUrl(primaryUrl)]))
  const merged = [...homepageRanked, ...extras].sort((a, b) => b.score - a.score)
  // Deduplicate by URL keeping highest score
  const best = new Map<string, RankedLink>()
  for (const link of merged) {
    const prev = best.get(link.url)
    if (!prev || link.score > prev.score) best.set(link.url, link)
  }
  pages = selectDiverse(primaryUrl, [...best.values()])
  return pages
}
