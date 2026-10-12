import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CheckAssertion } from './assertion'
import { observedInsecureResources, RESOURCE_TRANSPORT_SCOPE } from '../resource-transport'
import { LEGACY_IMAGE_AUDITS, PERFORMANCE_RESOURCE_THRESHOLDS, type ResourceAudit } from '../pagespeed-opportunities'
import { securityHeaderObservations } from './security-headers'
import { publicTrustObservations } from './trust'
import { consoleObservations } from './console'
import type { ConsoleCoverage } from '../console-evidence'

function recordResourceObservation(input: { key: string; name: string; ids: readonly ResourceAudit['id'][];
  data: PageSpeedResult; threshold: number; unit: ResourceAudit['unit'] }): CheckAssertion {
  const audits = input.ids.map(id => input.data.resourceAudits?.find(audit => audit.id === id))
  const measured = audits.filter((audit): audit is ResourceAudit & { savings: number; score: number } =>
    Boolean(audit && audit.unit === input.unit && audit.score !== null && audit.savings !== null))
  // Retain the existing policy: only a failed provider audit above the savings
  // threshold produces a Flag. One measured failure is useful even if another
  // audit is unavailable; recovery needs every relevant audit to be measured.
  const failed = measured.some(audit => audit.score < 1 && Math.round(audit.savings) > input.threshold)
  const complete = failed || measured.length === input.ids.length
  return { key: input.key, name: input.name,
    expected: `No failed provider audit exceeds ${input.threshold} ${input.unit} of potential savings`,
    observed: measured.length ? measured.map(audit => `${audit.providerAuditId}: score ${audit.score}, ${Math.round(audit.savings)} ${audit.unit} potential savings`).join('; ') +
      (measured.length < input.ids.length ? '. Other required resource audits are unavailable.' : '') : 'Required resource audit measurements are unavailable.',
    passed: complete && !failed, complete }
}

function recordResourceObservations(data: PageSpeedResult): CheckAssertion[] {
  const currentImages = data.resourceAudits?.some(audit => audit.providerAuditId === 'image-delivery-insight')
  return [
    recordResourceObservation({ key: 'render-blocking', name: 'Render-blocking resources', ids: ['render-blocking-resources'], data,
      threshold: PERFORMANCE_RESOURCE_THRESHOLDS.renderBlocking, unit: 'ms' }),
    recordResourceObservation({ key: 'unused-javascript', name: 'Unused JavaScript', ids: ['unused-javascript'], data,
      threshold: PERFORMANCE_RESOURCE_THRESHOLDS.unusedJavascript, unit: 'bytes' }),
    recordResourceObservation({ key: 'unused-css', name: 'Unused CSS', ids: ['unused-css-rules'], data,
      threshold: PERFORMANCE_RESOURCE_THRESHOLDS.unusedCss, unit: 'bytes' }),
    recordResourceObservation({ key: 'image-optimization', name: 'Image delivery', ids: currentImages ? ['uses-optimized-images'] : LEGACY_IMAGE_AUDITS,
      data, threshold: PERFORMANCE_RESOURCE_THRESHOLDS.images, unit: 'bytes' }),
  ]
}

export function recordInpObservation(mobile: PageSpeedResult): CheckAssertion {
  const complete = mobile.crux?.inp !== null && mobile.crux?.inp !== undefined
  return { key: 'inp', name: 'Mobile field responsiveness', expected: 'CrUX p75 INP is at most 200ms',
    observed: complete ? `CrUX p75 INP ${mobile.crux!.inp}ms, ${mobile.crux!.scope ?? 'unknown scope'} scope${mobile.crux!.url ? ` (${mobile.crux!.url})` : ''}, trailing ${mobile.crux!.reportingWindowDays ?? 28} days. This window does not verify an immediate repair.`
      : 'No CrUX INP measurement is available. Current responsiveness remains unknown.',
    passed: complete && mobile.crux!.inp! <= 200, complete, disposition: 'observed' }
}

/** Positive observations come from inspected inputs, never from missing Flags. */
export function recordCheckObservations(module: string, input: {
  url: string; metadata: PageMetadata; headers?: Record<string, string> | null;
  desktop: PageSpeedResult | null; mobile: PageSpeedResult | null;
  consoleCoverage?: ConsoleCoverage;
}): CheckAssertion[] {
  const result: CheckAssertion[] = []
  const record = (key: string, name: string, expected: string, observed: string, passed: boolean) => {
    result.push({ key, name, expected, observed, passed, complete: true })
  }
  if (module === 'trust') result.push(...Object.values(publicTrustObservations(input.metadata)))
  if (module === 'console') result.push(...consoleObservations(input.consoleCoverage))
  if (module === 'security') {
    const https = new URL(input.url).protocol === 'https:'
    record('https', 'Page uses HTTPS', 'The inspected page URL uses HTTPS', https ? 'HTTPS URL' : 'HTTP URL', https)
    if (https) {
      const insecure = observedInsecureResources(input.metadata, input.url).length
      const complete = input.metadata.resourceTransport?.complete === true
      result.push({ key: 'resource-transport', name: 'Declared resource transport',
        expected: 'Inspected HTML resource references do not use untrustworthy HTTP URLs',
        observed: `${insecure} HTTP resource references recorded. ${complete ? '' : 'Resource collection is incomplete. '}${RESOURCE_TRANSPORT_SCOPE}`,
        passed: complete && insecure === 0, complete })
    }
  }
  if (module === 'measurement') {
    record('analytics-markup', 'Analytics configuration in HTML', 'An analytics snippet is present in the captured HTML',
      input.metadata.hasAnalytics ? 'Analytics snippet detected' : 'No snippet detected; consent-delayed or proxied analytics may not appear here', input.metadata.hasAnalytics)
  }
  if (module === 'security-headers' && input.headers) {
    result.push(...securityHeaderObservations(input.url, input.headers))
  }
  if (module === 'performance' || module === 'mobile') {
    if (module === 'performance' && input.mobile) result.push(recordInpObservation(input.mobile))
    const data = module === 'mobile' ? input.mobile : input.desktop
    if (data) {
      const score = data.score
      const measuredScore = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
      result.push({ key: 'score', name: `${module === 'mobile' ? 'Mobile' : 'Desktop'} performance score`,
        expected: 'Measured performance score is at least 75/100', observed: measuredScore ? `${score}/100 in the recorded PageSpeed run` : 'No valid performance score is available.',
        complete: measuredScore, passed: measuredScore && score >= 75 })
      if (typeof data.lcp === 'number' && Number.isFinite(data.lcp)) record('lcp', `${module === 'mobile' ? 'Mobile' : 'Desktop'} largest contentful paint`,
        'Measured LCP is at most 2500ms', `${Math.round(data.lcp)}ms in the recorded PageSpeed run`, data.lcp <= 2500)
      if (typeof data.cls === 'number' && Number.isFinite(data.cls)) record('cls', `${module === 'mobile' ? 'Mobile' : 'Desktop'} layout shift`,
        'Measured CLS is at most 0.1', `${data.cls} in the recorded PageSpeed run`, data.cls <= 0.1)
      if (module === 'performance') result.push(...recordResourceObservations(data))
    }
  }
  return result
}
