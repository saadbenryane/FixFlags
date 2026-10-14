import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { observedInsecureResources, RESOURCE_TRANSPORT_SCOPE } from '../resource-transport'
import type { CheckAssertion } from './assertion'
import { displayDestination } from './destination-evidence'

export function securityObservations(url: string, meta: Pick<PageMetadata, 'images' | 'resourceTransport'> | null): CheckAssertion[] {
  const https = new URL(url).protocol === 'https:'
  const assertions: CheckAssertion[] = [{ key: 'https', name: 'Page uses HTTPS', expected: 'The inspected page URL uses HTTPS',
    observed: https ? 'HTTPS URL' : 'HTTP URL', passed: https, complete: true }]
  if (https) {
    const insecure = meta ? observedInsecureResources(meta, url).length : 0
    const complete = meta?.resourceTransport?.complete === true
    assertions.push({ key: 'resource-transport', name: 'Declared resource transport', expected: 'Inspected HTML resource references do not use untrustworthy HTTP URLs',
      observed: `${insecure} HTTP resource references recorded. ${complete ? '' : 'Resource collection is incomplete. '}${RESOURCE_TRANSPORT_SCOPE}`,
      passed: complete && insecure === 0, complete })
  }
  return assertions
}

export function runSecurityBasicsChecks(url: string, meta: PageMetadata | null): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const isHttps = new URL(url).protocol === 'https:'
  if (!isHttps) findings.push({
    checkId: 'no-https', rubric: 'REACH', impactTag: 'TRUST', severity: 'CRITICAL',
    problem: 'Site is not served over HTTPS', evidence: `URL: ${displayDestination(url)}`,
    fix: '1. Enable HTTPS on your hosting provider (Railway, Vercel, Netlify offer free SSL)\n2. Set up a 301 redirect from HTTP to HTTPS\n3. Update all internal links to use https:// URLs',
    confidence: 1.0, source: 'DETERMINISTIC',
  })
  const resources = isHttps && meta ? observedInsecureResources(meta, url) : []
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
