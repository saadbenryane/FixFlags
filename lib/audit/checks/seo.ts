import { PageMetadata } from '../metadata'
import { DeterministicFlag } from './index'

export async function runSeoChecks(
  url: string,
  meta: PageMetadata
): Promise<DeterministicFlag[]> {
  const findings: DeterministicFlag[] = []

  if (meta.h1s.length === 0) {
    findings.push({
      checkId: 'h1-missing',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: 'No H1 heading found',
      evidence: 'No <h1> element found in the page',
      fix: 'Add exactly one H1 tag containing the primary keyword for this page.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.h1s.length > 1) {
    findings.push({
      checkId: 'h1-multiple',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: `Multiple H1 headings found (${meta.h1s.length})`,
      evidence: `H1 tags found: ${meta.h1s.slice(0, 3).map((h) => `"${h}"`).join(', ')}`,
      fix: 'Use only one H1 per page. Make secondary headings H2 or H3.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (!meta.hasStructuredData) {
    findings.push({
      checkId: 'no-structured-data',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'POLISH',
      problem: 'No structured data (JSON-LD) found',
      evidence: 'No <script type="application/ld+json"> found in the page',
      fix: 'Add JSON-LD structured data. For SaaS landing pages, use WebSite + SoftwareApplication schema.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.externalLinksWithoutNoopener > 0) {
    findings.push({
      checkId: 'external-links-unsafe',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'POLISH',
      problem: `${meta.externalLinksWithoutNoopener} external link${meta.externalLinksWithoutNoopener > 1 ? 's' : ''} without rel="noopener"`,
      evidence: `External links found without rel="noopener noreferrer"`,
      fix: 'Add rel="noopener noreferrer" to all external links to prevent security issues.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  // Check sitemap
  try {
    const sitemapUrl = new URL('/sitemap.xml', url).toString()
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)
    const res = await fetch(sitemapUrl, { method: 'HEAD', signal: controller.signal })
    if (res.status === 404) {
      findings.push({
        checkId: 'sitemap-missing',
        rubric: 'REACH',
        impactTag: 'SEO',
        severity: 'POLISH',
        problem: 'XML sitemap not found at /sitemap.xml',
        evidence: `HEAD ${sitemapUrl} returned 404`,
        fix: 'Generate and submit a sitemap.xml. Next.js can auto-generate one with the sitemap.ts convention.',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } catch {}

  // Check robots.txt
  try {
    const robotsUrl = new URL('/robots.txt', url).toString()
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)
    const res = await fetch(robotsUrl, { method: 'HEAD', signal: controller.signal })
    if (res.status === 404) {
      findings.push({
        checkId: 'robots-txt-missing',
        rubric: 'REACH',
        impactTag: 'SEO',
        severity: 'POLISH',
        problem: 'robots.txt not found',
        evidence: `HEAD ${robotsUrl} returned 404`,
        fix: 'Create a robots.txt file. At minimum: User-agent: * / Allow: /',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } catch {}

  const brokenLinks = await findBrokenInternalLinks(url, meta)
  if (brokenLinks.length > 0) {
    findings.push({
      checkId: 'broken-internal-links',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: `${brokenLinks.length} internal link${brokenLinks.length > 1 ? 's' : ''} return errors`,
      evidence: brokenLinks.slice(0, 3).join('; '),
      fix: 'Fix or remove broken internal links. Update hrefs to valid routes or add redirects.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}

const MAX_LINK_CHECKS = 8

async function findBrokenInternalLinks(
  pageUrl: string,
  meta: PageMetadata
): Promise<string[]> {
  const origin = new URL(pageUrl).origin
  const seen = new Set<string>()
  const broken: string[] = []

  for (const link of meta.links) {
    if (broken.length >= 3) break
    if (!link.href || link.href.startsWith('#') || link.href.startsWith('mailto:')) continue

    let absolute: string
    try {
      absolute = new URL(link.href, pageUrl).toString()
    } catch {
      continue
    }

    if (!absolute.startsWith(origin) || seen.has(absolute)) continue
    seen.add(absolute)
    if (seen.size > MAX_LINK_CHECKS) break

    try {
      const controller = new AbortController()
      setTimeout(() => controller.abort(), 4000)
      const res = await fetch(absolute, { method: 'HEAD', signal: controller.signal })
      if (res.status === 404 || res.status >= 500) {
        broken.push(`${absolute} (${res.status})`)
      }
    } catch {
      broken.push(`${absolute} (unreachable)`)
    }
  }

  return broken
}
