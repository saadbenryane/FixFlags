import * as cheerio from 'cheerio'
import { safeFetchDocument, safeFetchHtml } from '@/lib/audit/url'

/** Bounded so one free check stays quick and polite to the site being checked. */
export const BROKEN_LINKS_MAX_LINKS = 40
const CONCURRENCY = 6

export type LinkResult = { url: string; path: string; text: string; status: number | null; problem: 'error_status' | 'unreachable' | null }
export type BrokenLinksResult = {
  url: string
  checked: number
  skipped: number
  broken: LinkResult[]
  error: string | null
}

/** Same-site http(s) links on the page, without fragments, in page order. */
export function extractInternalLinks(html: string, pageUrl: string): { url: string; text: string }[] {
  const base = new URL(pageUrl)
  const $ = cheerio.load(html)
  const seen = new Set<string>([new URL(base.pathname + base.search, base).href])
  const links: { url: string; text: string }[] = []
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href')?.trim()
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript|data):/i.test(href)) return
    let target: URL
    try { target = new URL(href, base) } catch { return }
    if (!/^https?:$/.test(target.protocol) || target.host !== base.host || target.username || target.password) return
    target.hash = ''
    if (seen.has(target.href)) return
    seen.add(target.href)
    links.push({ url: target.href, text: $(element).text().replace(/\s+/g, ' ').trim().slice(0, 80) })
  })
  return links
}

type Fetcher = (url: string) => Promise<{ statusCode: number }>

const defaultFetcher: Fetcher = url => safeFetchDocument(url, { publicOnly: true, timeoutMs: 6_000, maxBytes: 1_024 })

export async function checkLinks(links: readonly { url: string; text: string }[], fetcher: Fetcher = defaultFetcher): Promise<LinkResult[]> {
  const results: LinkResult[] = new Array(links.length)
  let next = 0
  async function worker() {
    while (next < links.length) {
      const index = next++
      const link = links[index]
      const path = new URL(link.url).pathname + new URL(link.url).search
      try {
        const { statusCode } = await fetcher(link.url)
        results[index] = { ...link, path, status: statusCode, problem: statusCode >= 400 ? 'error_status' : null }
      } catch {
        results[index] = { ...link, path, status: null, problem: 'unreachable' }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, links.length) }, worker))
  return results
}

export async function findBrokenLinks(rawUrl: string, fetcher?: Fetcher): Promise<BrokenLinksResult> {
  const input = rawUrl.trim()
  if (!input) return { url: input, checked: 0, skipped: 0, broken: [], error: 'Enter a URL' }
  const requested = /^https?:\/\//i.test(input) ? input : `https://${input}`
  try {
    const page = await safeFetchHtml(requested, { maxBytes: 2_000_000, headers: { 'User-Agent': 'FixFlags-LinkChecker/1.0' } })
    const links = extractInternalLinks(page.html, page.finalUrl)
    const selected = links.slice(0, BROKEN_LINKS_MAX_LINKS)
    const results = await checkLinks(selected, fetcher)
    return { url: page.finalUrl, checked: selected.length, skipped: links.length - selected.length, broken: results.filter(result => result.problem), error: null }
  } catch {
    return { url: requested, checked: 0, skipped: 0, broken: [], error: 'We couldn’t open that page. Check the address and try again.' }
  }
}
