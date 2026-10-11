import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { observedInsecureResources, RESOURCE_TRANSPORT_SCOPE } from '../resource-transport'

export function runSecurityBasicsChecks(url: string, meta: PageMetadata): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const isHttps = new URL(url).protocol === 'https:'
  const resources = isHttps ? observedInsecureResources(meta, url) : []
  const mixedContentUrls = [...new Set(resources.map(resource => resource.url))]

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
      problem: `HTTPS page declares ${mixedContentUrls.length} HTTP resource${mixedContentUrls.length > 1 ? 's' : ''} (mixed content risk)`,
      evidence: `HTTP resource references (${[...new Set(resources.map(resource => resource.kind))].join(', ')}): ${sample}${remaining > 0 ? ` and ${remaining} more` : ''}. Browsers may block or upgrade these requests. ${RESOURCE_TRANSPORT_SCOPE}`,
      fix: '1. Serve the affected resources over HTTPS\n2. Update HTTP script, stylesheet, image, frame and media URLs, including responsive candidates and the document base URL\n3. Confirm the secure resources still work after the change',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
