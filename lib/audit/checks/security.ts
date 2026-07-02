import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from './index'

export function runSecurityBasicsChecks(url: string, meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const isHttps = url.startsWith('https://')
  const mixedContentUrls: string[] = []

  if (isHttps) {
    for (const img of meta.images) {
      if (img.src.startsWith('http://')) {
        mixedContentUrls.push(img.src)
      }
    }
    for (const link of meta.links) {
      if (link.href.startsWith('http://')) {
        mixedContentUrls.push(link.href)
      }
    }
  }

  if (mixedContentUrls.length > 0) {
    const sample = mixedContentUrls.slice(0, 3).map((u) => {
      try { return new URL(u).pathname } catch { return u }
    }).join(', ')
    const remaining = mixedContentUrls.length - 3

    findings.push({
      checkId: 'security-mixed-content',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'CRITICAL',
      problem: `HTTPS page loads ${mixedContentUrls.length} resource${mixedContentUrls.length > 1 ? 's' : ''} over HTTP (mixed content)`,
      evidence: `Found HTTP resources: ${sample}${remaining > 0 ? ` and ${remaining} more` : ''}. Browsers may block or warn on these resources.`,
      fix: '1. Update all HTTP URLs to HTTPS\n2. Replace HTTP image src and link href attributes with HTTPS equivalents\n3. Use protocol-relative URLs (//) or check if your CMS has a "force HTTPS" setting',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}