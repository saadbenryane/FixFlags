import type { PageMetadata } from '../metadata'
import type { PageSpeedResult } from '../pagespeed'
import type { CheckAssertion } from './assertion'
import { securityObservations } from './security'
import { RESOURCE_CHECK_POLICIES, resourceAuditContext, type ResourceAudit } from '../pagespeed-opportunities'
import { securityHeaderObservations } from './security-headers'
import { publicTrustObservations } from './trust'
import { consoleObservations } from './console'
import type { ConsoleCoverage } from '../console-evidence'
import { tapTargetObservations } from '../pagespeed-tap-targets'
import { scopePerformanceAssertions } from '../performance-measurement'

function recordResourceObservation(input: { key: string; name: string; ids: readonly ResourceAudit['id'][];
  url: string; data: PageSpeedResult | null; threshold: number; unit: ResourceAudit['unit'] }): CheckAssertion {
  const audits = input.ids.map(id => input.data?.resourceAudits?.find(audit => audit.id === id))
  const measured = audits.filter((audit): audit is ResourceAudit & { savings: number; score: number } =>
    Boolean(audit && audit.unit === input.unit && audit.score !== null && audit.savings !== null))
  // Retain the existing policy: only a failed provider audit above the savings
  // threshold produces a Flag. One measured failure is useful even if another
  // audit is unavailable; recovery needs every relevant audit to be measured.
  const failed = measured.some(audit => audit.score < 1 && Math.round(audit.savings) > input.threshold)
  const complete = failed || measured.length === input.ids.length
  const measurements = measured.map(audit => ({ context: resourceAuditContext(input.url, input.data!.strategy, audit, input.threshold),
    passed: !(audit.score < 1 && Math.round(audit.savings) > input.threshold),
    observed: `${audit.providerAuditId}: score ${audit.score}, ${Math.round(audit.savings)} ${audit.unit} potential savings` }))
  return { key: input.key, name: input.name,
    expected: `No failed provider audit exceeds ${input.threshold} ${input.unit} of potential savings`,
    observed: measured.length ? measurements.map(measurement => measurement.observed).join('; ') +
      (measured.length < input.ids.length ? '. Other required resource audits are unavailable.' : '') : 'Required resource audit measurements are unavailable.',
    passed: complete && !failed, complete, measurements,
    targets: measured.map(audit => ({ selector: 'lighthouse:' + audit.providerAuditId, label: audit.providerAuditId,
      context: resourceAuditContext(input.url, input.data!.strategy, audit, input.threshold) })) }
}

function recordResourceObservations(data: PageSpeedResult | null, url: string): CheckAssertion[] {
  const currentImages = data?.resourceAudits?.some(audit => audit.providerAuditId === 'image-delivery-insight')
  return Object.values(RESOURCE_CHECK_POLICIES).map(policy => recordResourceObservation({ ...policy, data, url,
    ids: policy.key === 'image-optimization' && currentImages ? ['uses-optimized-images'] : policy.ids }))
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
  url: string; metadata: PageMetadata | null; headers?: Record<string, string> | null;
  desktop: PageSpeedResult | null; mobile: PageSpeedResult | null;
  consoleCoverage?: ConsoleCoverage;
}): CheckAssertion[] {
  const result: CheckAssertion[] = []
  const record = (key: string, name: string, expected: string, observed: string, passed: boolean) => {
    result.push({ key, name, expected, observed, passed, complete: true })
  }
  if (module === 'trust') {
    if (!input.metadata) throw new Error('Public trust metadata is unavailable')
    result.push(...Object.values(publicTrustObservations(input.metadata)))
  }
  if (module === 'console') result.push(...consoleObservations(input.consoleCoverage))
  if (module === 'security') result.push(...securityObservations(input.url, input.metadata))
  if (module === 'measurement') {
    if (!input.metadata) throw new Error('Analytics markup is unavailable')
    record('analytics-markup', 'Analytics configuration in HTML', 'An analytics snippet is present in the captured HTML',
      input.metadata.hasAnalytics ? 'Analytics snippet detected' : 'No snippet detected; consent-delayed or proxied analytics may not appear here', input.metadata.hasAnalytics)
  }
  if (module === 'security-headers' && input.headers) {
    result.push(...securityHeaderObservations(input.url, input.headers))
  }
  if (module === 'performance' || module === 'mobile') {
    if (module === 'performance' && input.mobile) result.push(recordInpObservation(input.mobile))
    const data = module === 'mobile' ? input.mobile : input.desktop
    const score = data?.score
    const measuredScore = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
    result.push({ key: 'score', name: `${module === 'mobile' ? 'Mobile' : 'Desktop'} performance score`,
      expected: 'Measured performance score is at least 75/100', observed: measuredScore ? `${score}/100 in the recorded PageSpeed run` : 'No valid performance score is available.',
      complete: measuredScore, passed: measuredScore && score >= 75 })
    for (const metric of [{ key: 'lcp', name: 'largest contentful paint', value: data?.lcp, threshold: 2500, unit: 'ms' },
      { key: 'cls', name: 'layout shift', value: data?.cls, threshold: 0.1, unit: '' }]) {
      const measured = typeof metric.value === 'number' && Number.isFinite(metric.value) && metric.value >= 0
      result.push({ key: metric.key, name: `${module === 'mobile' ? 'Mobile' : 'Desktop'} ${metric.name}`,
        expected: `Measured ${metric.key.toUpperCase()} is at most ${metric.threshold}${metric.unit}`,
        observed: measured ? `${metric.value}${metric.unit} in the recorded PageSpeed run` : `No valid ${metric.key.toUpperCase()} measurement is available.`,
        complete: measured, passed: measured && metric.value! <= metric.threshold })
    }
    result.push(...recordResourceObservations(data ?? null, input.url))
    if (module === 'mobile') result.push(...tapTargetObservations(data?.tapTargetAudits))
    if (data) return scopePerformanceAssertions(data, input.url, result)
  }
  return result
}
