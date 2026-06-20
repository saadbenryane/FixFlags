import { parseMetadataFromHtml } from '@/lib/audit/metadata'
import { runAllChecks, type DeterministicFlag } from '@/lib/audit/checks'

const LOCALHOST_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i

export function isDemoLocalhostUrl(url: string): boolean {
  return LOCALHOST_PATTERN.test(url)
}

/** Fetch demo HTML without public-URL guard (dev fixture verification only). */
export async function fetchDemoPageHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'FixFlags-DemoFixture/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!response.ok) {
      throw new Error(`GET ${url} returned HTTP ${response.status}`)
    }
    const html = await response.text()
    return { html, finalUrl: url }
  } finally {
    clearTimeout(timeout)
  }
}

export async function auditDemoUrl(url: string): Promise<DeterministicFlag[]> {
  if (!isDemoLocalhostUrl(url)) {
    throw new Error('auditDemoUrl is only for localhost demo fixture verification')
  }
  const { html, finalUrl } = await fetchDemoPageHtml(url)
  const metadata = parseMetadataFromHtml(html, finalUrl)
  const { flags } = await runAllChecks(finalUrl, metadata, null, null, [])
  return flags
}
