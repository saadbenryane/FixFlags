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
      fix: '1. Add exactly one H1 tag containing the primary keyword\n2. Place it at the top of the main content area\n3. Make it descriptive, not generic ("Build X for Y" not "Welcome")',
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
      fix: '1. Keep only one H1 as the main page heading\n2. Change additional H1s to H2 or H3\n3. Maintain a logical heading hierarchy throughout the page',
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
      fix: '1. Add JSON-LD structured data to the page head\n2. For SaaS landing pages, use WebSite + SoftwareApplication schema\n3. Test with Google Rich Results Test tool',
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
      fix: '1. Add rel="noopener noreferrer" to every external link\n2. Apply this to links opening in new tabs (target=_blank)\n3. Verify with DevTools that the attribute is present on external links',
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
        fix: '1. Generate a sitemap.xml listing all public pages\n2. In Next.js, create a sitemap.ts file for auto-generation\n3. Submit the sitemap to Google Search Console',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } catch {
    // sitemap fetch failed, skip flagging
  }

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
        fix: '1. Create a robots.txt file at the root of your domain\n2. Add: User-agent: * / Allow: /\n3. Optionally point to your sitemap: Sitemap: https://yourdomain.com/sitemap.xml',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
  } catch {
    // robots.txt fetch failed, skip flagging
  }

  const brokenLinks = await findBrokenInternalLinks(url, meta)
  if (brokenLinks.length > 0) {
    findings.push({
      checkId: 'broken-internal-links',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: `${brokenLinks.length} internal link${brokenLinks.length > 1 ? 's' : ''} return errors`,
      evidence: brokenLinks.slice(0, 3).join('; '),
      fix: '1. Identify the broken internal links from the evidence\n2. Update href values to valid routes or correct URLs\n3. Add server-side redirects if the target URL has changed',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const idSet = new Set(meta.elementIds)
  const brokenAnchors: string[] = []
  for (const link of meta.links) {
    if (!link.href.startsWith('#') || link.href === '#') continue
    const target = link.href.slice(1).toLowerCase()
    if (target && !idSet.has(target)) {
      brokenAnchors.push(`${link.text || '(no text)'} → ${link.href}`)
    }
  }
  if (brokenAnchors.length > 0) {
    findings.push({
      checkId: 'broken-page-anchors',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `${brokenAnchors.length} on-page link${brokenAnchors.length > 1 ? 's' : ''} point to missing sections`,
      evidence: brokenAnchors.slice(0, 3).join('; '),
      fix: '1. Add matching id attributes for each hash link target (#section-name)\n2. Update nav or footer links to point to existing section ids\n3. Test each anchor link by clicking and verifying it scrolls correctly',
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
