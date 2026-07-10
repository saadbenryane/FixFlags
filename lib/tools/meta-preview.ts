import { prisma } from '@/lib/db'
import { createHash } from 'node:crypto'

export interface MetaPreviewResult {
  url: string
  title: string | null
  description: string | null
  ogImage: string | null
  ogTitle: string | null
  ogDescription: string | null
  twitterCard: string | null
  twitterImage: string | null
  favicon: string | null
  hasCanonical: boolean
  hasRobots: boolean
  statusCode: number | null
  error: string | null
}

function hashInput(url: string): string {
  return createHash('sha256').update(url.toLowerCase()).digest('hex').slice(0, 16)
}

export async function checkMetaPreview(url: string): Promise<MetaPreviewResult> {
  const input = url.trim()
  if (!input) {
    return { url, title: null, description: null, ogImage: null, ogTitle: null, ogDescription: null, twitterCard: null, twitterImage: null, favicon: null, hasCanonical: false, hasRobots: false, statusCode: null, error: 'Enter a URL' }
  }

  let normalized: string
  try {
    const p = new URL(input.startsWith('http') ? input : `https://${input}`)
    normalized = p.toString()
  } catch {
    return { url: input, title: null, description: null, ogImage: null, ogTitle: null, ogDescription: null, twitterCard: null, twitterImage: null, favicon: null, hasCanonical: false, hasRobots: false, statusCode: null, error: 'Invalid URL' }
  }

  try {
    const res = await fetch(normalized, {
      headers: { 'User-Agent': 'FixFlags-MetaPreview/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    })

    const html = await res.text()
    const getMeta = (name: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`, 'i'),
      ]
      for (const p of patterns) {
        const m = html.match(p)
        if (m) return m[1]
      }
      return null
    }

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null
    const description = getMeta('description')
    const ogTitle = getMeta('og:title')
    const ogDescription = getMeta('og:description')
    const ogImage = getMeta('og:image')
    const twitterCard = getMeta('twitter:card')
    const twitterImage = getMeta('twitter:image')
    const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i)
    const favicon = faviconMatch ? faviconMatch[1] : null
    const hasCanonical = /rel=["']canonical["']/i.test(html)
    const hasRobots = /name=["']robots["']/i.test(html)

    // Track usage (fire-and-forget)
    prisma.toolUsage.create({
      data: {
        toolSlug: 'meta-preview',
        inputHash: hashInput(normalized),
        result: { title, description, ogImage: !!ogImage },
        source: 'TOOL_PAGE',
      },
    }).catch(() => {})

    return {
      url: normalized,
      title,
      description,
      ogImage,
      ogTitle,
      ogDescription,
      twitterCard,
      twitterImage,
      favicon,
      hasCanonical,
      hasRobots,
      statusCode: res.status,
      error: null,
    }
  } catch (err) {
    return {
      url: normalized,
      title: null, description: null, ogImage: null, ogTitle: null, ogDescription: null,
      twitterCard: null, twitterImage: null, favicon: null,
      hasCanonical: false, hasRobots: false,
      statusCode: null,
      error: err instanceof Error && err.name === 'TimeoutError' ? 'Request timed out' : 'Could not fetch page',
    }
  }
}
