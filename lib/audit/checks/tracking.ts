import { trackingPageKey } from '../tracking/identity'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { TRACKING_PROVIDERS, type TrackingEvidence, type TrackingRequest } from '../tracking/contracts'
import { runMeasurementChecks } from './measurement'

export function trackingContext(request: TrackingRequest, pageUrl: string): string {
  return `tracking:${request.phase}:${request.provider}:${request.role}:${request.hostname}${request.endpoint}:page:${trackingPageKey(pageUrl)}`
}

/** HTTP observations establish resource transfer or endpoint responses. They
 * never establish provider ingestion, property routing, or visitor consent. */
export function runTrackingChecks(meta: PageMetadata, evidence: TrackingEvidence | undefined, pageUrl: string) {
  const flags: DeterministicFlag[] = evidence?.phase === 'public_action' || evidence?.requests.length ? [] : runMeasurementChecks(meta)
  const assertions: CheckAssertion[] = [{ key: 'analytics-markup', name: 'Analytics configuration in HTML',
    expected: 'An analytics snippet is present in captured HTML', observed: meta.hasAnalytics ? 'Analytics markup detected; execution and delivery are separate observations.' : 'No snippet detected; runtime, consent-delayed, or proxied analytics may not appear here.',
    passed: meta.hasAnalytics, complete: true, ...(!meta.hasAnalytics && evidence?.requests.length ? { disposition: 'observed' as const } : {}) }]
  const limitation = 'Tracking observations cover recognized endpoints in this browser window. Event requests are suppressed by FixFlags to avoid adding audit traffic. FixFlags does not grant consent to test tracking; an existing action walk may dismiss consent UI. Consent state is not independently established. Service workers are blocked, and embedded-frame traffic is outside the assessed scope. Proxies, other providers, later interactions and provider-recorded events remain unverified.'
  if (!evidence) {
    assertions.push({ key: 'tracking-initiation', name: 'Runtime tracking evidence unavailable', expected: 'Browser request evidence is available',
      observed: 'Only markup was inspected. Library loading, event initiation, destination responses and provider recording remain unknown.', passed: false, complete: false })
    return { flags, assertions, complete: false, limitation }
  }
  if (evidence.phase === 'public_action') assertions.length = 0
  const groups = new Map<string, TrackingRequest[]>()
  for (const request of evidence.requests) {
    const context = trackingContext(request, pageUrl), group = groups.get(context) ?? []
    group.push(request); groups.set(context, group)
  }
  const scope = evidence.phase === 'page_load' ? 'during page loading' : 'during the existing public action walk, including overlay handling'
  function observe(key: string, name: string, expected: string, observed: string, passed: boolean | null, context?: string, descriptive = false) {
    assertions.push({ key, name, expected, observed, passed: passed === true, complete: passed !== null,
      ...(context ? { context } : {}), ...(descriptive ? { disposition: 'observed' as const } : {}) })
  }
  for (const [context, requests] of groups) {
    const first = requests[0], provider = TRACKING_PROVIDERS[first.provider]
    const endpoint = first.hostname + first.endpoint
    const errors = requests.filter(request => request.status !== null && request.status >= 400)
    const successful = requests.every(request => request.status !== null && (request.status >= 200 && request.status < 300 || request.role === 'library' && request.status === 304) &&
      (request.role === 'event' || request.state === 'completed'))
    if (first.role === 'library') {
      observe('tracking-library', `${provider}: library resource`, 'The requested library resource completes without an HTTP error',
        errors.length ? `${endpoint} returned HTTP ${[...new Set(errors.map(request => request.status))].join(', ')} ${scope}.` : successful ? `${endpoint} completed its resource transfer ${scope}. This does not prove library initialization or tracking delivery.` : `${endpoint} was requested ${scope}, but successful transfer was not established. Browser blocking, transport failures or the observation limit may affect this result.`,
        errors.length ? false : successful ? true : null, context)
    } else {
      observe('tracking-initiation', `${provider}: event request initiated`, 'An event collection request is initiated by the page',
        `${requests.length} request attempt${requests.length === 1 ? '' : 's'} to ${endpoint} ${scope}. Payloads, identifiers and event values were not retained.`, true, context, true)
      const suppressed = requests.filter(request => request.state === 'suppressed').length
      observe('tracking-http-response', `${provider}: destination response`, 'The event destination returns a successful HTTP response',
        errors.length ? `${endpoint} returned HTTP ${[...new Set(errors.map(request => request.status))].join(', ')} ${scope}.` : successful ? `${endpoint} returned a successful HTTP response ${scope}. This establishes an endpoint response, not provider ingestion.` : suppressed ? `${suppressed} attempt${suppressed === 1 ? ' was' : 's were'} intentionally stopped by FixFlags before delivery. Destination availability and provider recording remain unknown.` : 'No conclusive destination response was recorded. Browser restrictions, consent policy or the observation window may affect this result.',
        errors.length ? false : successful ? true : null, context)
      observe('tracking-provider-recording', `${provider}: provider recording`, 'The provider independently confirms the relevant event was recorded',
        'No independent event-level provider confirmation was obtained. HTTP responses and aggregate audience reports do not certify that this event was recorded.', null, context)
    }
    if (errors.length) {
      const checkId = first.role === 'library' ? 'tracking-library-http-error' : 'tracking-endpoint-http-error'
      flags.push({ checkId, rubric: 'REACH', impactTag: 'MEASUREMENT', severity: 'IMPORTANT',
        problem: first.role === 'library' ? 'A requested tracking library returned an HTTP error' : 'A tracking destination returned an HTTP error',
        evidence: `${provider}: ${endpoint} returned HTTP ${[...new Set(errors.map(request => request.status))].join(', ')} ${scope}. This is the observed browser response; consent, bot restrictions and proxy policy may differ for normal visitors.`,
        fix: '1. Check the recorded endpoint URL, deployment and provider configuration.\n2. Inspect the same request for a normal visitor under the intended consent policy.\n3. Resolve the HTTP error without bypassing consent or intentional access restrictions.\n4. Repeat the same browser scope. Separately confirm provider ingestion and the intended property when authorized.',
        confidence: 0.95, source: 'DETERMINISTIC', pageUrl,
        verificationRule: 'Tracking observation: repeat the same provider, endpoint and browser phase. An unrelated script or request cannot certify this repair.',
        evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: `${provider}: ${endpoint}`, context }] })
    }
  }
  if (!evidence.requests.some(request => request.role === 'library')) observe('tracking-library', 'Library loading not established',
    'Browser evidence establishes a recognized tracking library transfer', 'No recognized external library transfer was observed. Inline or bundled code, consent, intentional blocking, unsupported providers and proxies remain possible.', null)
  if (!evidence.requests.some(request => request.role === 'event')) observe('tracking-initiation', 'Event initiation not established',
    'Browser evidence establishes relevant event requests', `${scope}: no recognized event collection request was observed. Consent, intentional blocking, unsupported or proxied providers, and delayed execution can explain this. No missing-event failure is inferred.`, null)
  if (!evidence.requests.some(request => request.role === 'event')) {
    observe('tracking-http-response', 'Tracking destination remains unverified', 'The event destination provides an observable response', 'No event-level destination response was established in this scope.', null)
    observe('tracking-provider-recording', 'Provider recording remains unverified', 'Independent provider evidence confirms relevant events', 'No independent event-level confirmation was obtained. Aggregate audience reports are separate evidence.', null)
  }
  // Retain all endpoint scopes before the existing finding collapse runs.
  const grouped = new Map<string, DeterministicFlag>()
  for (const flag of flags) {
    const prior = grouped.get(flag.checkId)
    if (!prior) grouped.set(flag.checkId, flag)
    else { prior.evidence += '\n' + flag.evidence; prior.evidenceTargets = [...(prior.evidenceTargets ?? []), ...(flag.evidenceTargets ?? [])] }
  }
  return { flags: [...grouped.values()], assertions,
    complete: !evidence.truncated && !evidence.requests.some(request => request.state === 'pending' || request.role === 'library' && request.state === 'response'),
    limitation: `${evidence.durationMs}ms browser observation. ${evidence.truncated ? 'The request limit was reached. ' : ''}${limitation}` }
}
