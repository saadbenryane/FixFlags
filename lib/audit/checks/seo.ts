import { PageMetadata } from '../metadata'
import { DeterministicFinding } from './index'

export async function runSeoChecks(
  url: string,
  meta: PageMetadata
): Promise<DeterministicFinding[]> {
  const findings: DeterministicFinding[] = []

  if (meta.h1s.length === 0) {
    findings.push({
      checkId: 'h1-missing',
      area: 'SEO',
      severity: 'HIGH',
      problem: 'No H1 heading found',
      evidence: 'No <h1> element found in the page',
      fix: 'Add exactly one H1 tag containing the primary keyword for this page.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  } else if (meta.h1s.length > 1) {
    findings.push({
      checkId: 'h1-multiple',
      area: 'SEO',
      severity: 'MEDIUM',
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
      area: 'SEO',
      severity: 'MEDIUM',
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
      area: 'SEO',
      severity: 'LOW',
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
        area: 'SEO',
        severity: 'MEDIUM',
        problem: 'XML sitemap not found at /sitemap.xml',
        evidence: `GET ${sitemapUrl} returned 404`,
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
        area: 'SEO',
        severity: 'LOW',
        problem: 'robots.txt not found',
        evidence: `GET ${robotsUrl} returned 404`,
        fix: 'Create a robots.txt file. At minimum: User-agent: * / Allow: /',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } catch {}

  return findings
}
