import { auditDemoFixture } from '@/lib/demo/audit-demo-fixtures'
import type { DemoFixtureKey } from '@/lib/demo/audit-demo-fixtures'

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

export async function auditDemoUrl(url: string, key: DemoFixtureKey = 'v1') {
  const path = key === 'original' ? '/demo' : '/demo/v1'
  const base = url.replace(path, '')
  const result = await auditDemoFixture(key, { mode: 'live', baseUrl: base })
  return result.flags
}
