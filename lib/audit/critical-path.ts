import { PageMetadata } from './metadata'

const MAX_URLS = 3

function resolveSameOrigin(origin: string, href: string): string | null {
  try {
    if (href.startsWith('/')) return new URL(href, origin).toString()
    const parsed = new URL(href)
    if (parsed.origin === origin) return parsed.toString()
    return null
  } catch {
    return null
  }
}

function scoreLink(href: string, text: string): number {
  const combined = `${href} ${text}`.toLowerCase()
  if (/pricing|plans|price/.test(combined)) return 100
  if (/signup|sign-up|register|login|get-started|start/.test(combined)) return 90
  if (/contact|demo/.test(combined)) return 50
  return 0
}

/** Up to 3 same-origin URLs: primary + pricing + primary CTA destination. */
export function discoverCriticalPathUrls(primaryUrl: string, metadata: PageMetadata): string[] {
  const origin = new URL(primaryUrl).origin
  const ordered = [primaryUrl]
  const seen = new Set<string>([primaryUrl])

  const ranked = metadata.links
    .map((link) => {
      const resolved = resolveSameOrigin(origin, link.href)
      if (!resolved || seen.has(resolved)) return null
      const score = scoreLink(link.href, link.text)
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
