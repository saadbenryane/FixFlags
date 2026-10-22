import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { observedInsecureResources, RESOURCE_TRANSPORT_SCOPE } from '../resource-transport'
import type { CheckAssertion } from './assertion'
import { destinationContext, displayDestination } from './destination-evidence'
import type { PublicDocument } from '../search/contracts'
import { certificateFailureReason, TLS_CERTIFICATE_VERIFICATION_RULE } from '../tls-evidence'
import { TLS_CERTIFICATE_COPY } from '@/lib/marketing/copy/tls'
import { isUnresolvedPublicRedirect } from '../redirect-evidence'

export function certificateRequestContext(pageUrl: string) {
  return 'tls-certificate:v1:' + destinationContext(pageUrl, pageUrl)
}

/** One recorded public transport owns protocol, peer-certificate and HTML
 * resource interpretation for both progressive and compatibility adapters. */
export function assessSecurityTransport(pageUrl: string, metadata: PageMetadata | null, document?: PublicDocument) {
  const matched = document && new URL(document.url).href === new URL(pageUrl).href ? document : undefined
  const responseObserved = Boolean(matched && matched.status !== null && !matched.transportFailure && !isUnresolvedPublicRedirect(matched))
  const reachedUrl = matched?.finalUrl ?? pageUrl
  const inspectedMetadata = !document || responseObserved ? metadata : null
  const flags = runSecurityBasicsChecks(reachedUrl, inspectedMetadata)
  const assertions = securityObservations(reachedUrl, inspectedMetadata)
  if (document && !responseObserved) {
    assertions[0] = { ...assertions[0], passed: false, complete: false, observed: 'No matching HTTP response established the final connection protocol.' }
    // A failed request cannot establish a new protocol finding from its URL alone.
    const index = flags.findIndex(flag => flag.checkId === 'no-https')
    if (index >= 0) flags.splice(index, 1)
  }
  if (document || new URL(pageUrl).protocol === 'https:' || new URL(reachedUrl).protocol === 'https:') {
    const failure = matched?.transportFailure
    const trustedResponse = responseObserved && new URL(reachedUrl).protocol === 'https:'
    const noTlsResponse = responseObserved && new URL(pageUrl).protocol === 'http:' && new URL(reachedUrl).protocol === 'http:'
    const context = certificateRequestContext(pageUrl)
    const observed = failure ? `${TLS_CERTIFICATE_COPY[certificateFailureReason(failure)].label} at ${displayDestination(reachedUrl)} (${failure.code}). No HTTP response was obtained.`
      : trustedResponse ? `The public request reached ${displayDestination(reachedUrl)} over HTTPS with normal certificate and hostname verification.`
        : noTlsResponse ? 'The public request completed over HTTP. No HTTPS certificate was observed.'
          : 'No verified HTTPS response or recognized peer-certificate refusal was recorded for this public request.'
    assertions.push({ key: 'tls-certificate', name: 'HTTPS certificate',
      expected: 'The original public request completes over HTTPS with normal certificate and hostname verification',
      observed, passed: trustedResponse, complete: Boolean(failure || trustedResponse || noTlsResponse), context,
      ...(noTlsResponse ? { disposition: 'observed' as const } : {}) })
    if (failure) {
      const copy = TLS_CERTIFICATE_COPY[certificateFailureReason(failure)]
      flags.push({ checkId: 'security-certificate-invalid', rubric: 'REACH', impactTag: 'TRUST', severity: 'CRITICAL',
        confidence: 1, source: 'DETERMINISTIC', pageUrl, problem: copy.problem, evidence: observed,
        fix: copy.fix,
        verificationRule: TLS_CERTIFICATE_VERIFICATION_RULE,
        evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'HTTPS certificate', context }] })
    }
  }
  return { flags, assertions, complete: assertions.every(assertion => assertion.complete === true),
    collectedAt: matched?.collectedAt,
    limitation: 'Public TLS and response evidence is separate from HTML resource declarations, rendered behavior and future certificate validity.' }
}

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
