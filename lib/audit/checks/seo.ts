import { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'

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
  } else {
    // Only flag genuinely competing headings. Responsive layouts render the same
    // H1 twice (one hidden per breakpoint), which is not an SEO problem, so
    // dedupe by text and flag only when more than one distinct H1 remains.
    const distinctH1s = [...new Set(meta.h1s.map((h) => h.trim().toLowerCase()).filter(Boolean))]
    if (distinctH1s.length > 1) {
      findings.push({
        checkId: 'h1-multiple',
        rubric: 'REACH',
        impactTag: 'SEO',
        severity: 'POLISH',
        problem: `Multiple different H1 headings found (${distinctH1s.length})`,
        evidence: `Distinct H1 tags: ${[...new Set(meta.h1s.map((h) => h.trim()).filter(Boolean))].slice(0, 3).map((h) => `"${h}"`).join(', ')}`,
        fix: '1. Keep only one H1 as the main page heading\n2. Change additional H1s to H2 or H3\n3. Maintain a logical heading hierarchy throughout the page',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    }
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

  // Note: rel="noopener" is intentionally not checked. Every major browser has
  // defaulted target="_blank" to noopener behaviour since 2021, so its absence is
  // no longer a real vulnerability. Flagging it produced noise on well-built sites.

  // Check robots.txt (GET, so its Sitemap: directives can be read). Large sites
  // often declare their sitemap in robots.txt rather than serving /sitemap.xml,
  // so reading it prevents a false "sitemap missing" flag.
  let robotsSitemapDeclared = false
  try {
    const robotsUrl = new URL('/robots.txt', url).toString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FixFlags/1.0 (+https://fixflags.com)' },
    })
    clearTimeout(timeout)
    if (res.status === 404) {
      findings.push({
        checkId: 'robots-txt-missing',
        rubric: 'REACH',
        impactTag: 'SEO',
        severity: 'POLISH',
        problem: 'robots.txt not found',
        evidence: `${robotsUrl} returned 404`,
        fix: '1. Create a robots.txt file at the root of your domain\n2. Add: User-agent: * / Allow: /\n3. Optionally point to your sitemap: Sitemap: https://yourdomain.com/sitemap.xml',
        confidence: 1.0,
        source: 'DETERMINISTIC',
      })
    } else if (res.ok) {
      const body = (await res.text()).slice(0, 100_000)
      robotsSitemapDeclared = /^\s*sitemap\s*:\s*\S+/im.test(body)
    }
  } catch {
    // robots.txt fetch failed, skip flagging
  }

  // Only flag a missing sitemap when neither /sitemap.xml exists nor robots.txt
  // declares one.
  if (!robotsSitemapDeclared) {
    try {
      const sitemapUrl = new URL('/sitemap.xml', url).toString()
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(sitemapUrl, { method: 'HEAD', signal: controller.signal })
      clearTimeout(timeout)
      if (res.status === 404) {
        findings.push({
          checkId: 'sitemap-missing',
          rubric: 'REACH',
          impactTag: 'SEO',
          severity: 'POLISH',
          problem: 'No XML sitemap found',
          evidence: `${sitemapUrl} returned 404 and robots.txt declares no Sitemap:`,
          fix: '1. Generate a sitemap.xml listing all public pages\n2. In Next.js, create a sitemap.ts file for auto-generation\n3. Reference it in robots.txt (Sitemap: https://yourdomain.com/sitemap.xml) and submit it to Google Search Console',
          confidence: 1.0,
          source: 'DETERMINISTIC',
        })
      }
    } catch {
      // sitemap fetch failed, skip flagging
    }
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
