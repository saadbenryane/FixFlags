import { isComparableTrackingContext, trackingPageKey, TRACKING_VERIFICATION_RULE } from '../tracking/identity'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { libraryResponseWithoutFullBody, TRACKING_PROVIDERS, type TrackingEvidence, type TrackingRequest } from '../tracking/contracts'
import { trackingEndpointLabel } from '../tracking/endpoints'
import { runMeasurementChecks } from './measurement'
import type { PublicPageSignals } from '../browser/public-page-signals'
import { publicResponseStatusRestriction } from '../http-evidence'

export function trackingContext(request: TrackingRequest, pageUrl: string, phaseCaptureKey?: string): string {
  const captureKey = request.captureKey ?? phaseCaptureKey
  const actionKey = request.phase === 'public_action' && request.captureKey && request.requestKey ? request.actionKey : undefined
  const version = actionKey ? 5 : request.captureKey ? 4 : 3
  const identity = request.requestKey && captureKey ? `:request:v${version}:${request.requestKey}:capture:${captureKey}` : ''
  const action = request.phase === 'public_action' ? ':control:' + (actionKey ?? 'unattributed') : ''
  return `tracking:${request.phase}:${request.provider}:${request.role}:${request.hostname}${trackingEndpointLabel(request)}${identity}${action}:page:${trackingPageKey(pageUrl)}`
}

function responseVerdict(request: TrackingRequest): boolean | 'restricted' | null {
  if (request.responseKind === 'challenge' || request.status === null || request.state === 'suppressed') return null
  if (publicResponseStatusRestriction(request.status)) return 'restricted'
  if (request.status >= 400) return false
  return !request.responseKind && request.status >= 200 && request.status < 300 &&
    (request.role === 'event' ? request.eventResponseQualified === true
      : request.state === 'completed' && request.libraryResponseQualified === true && !libraryResponseWithoutFullBody(request)) ? true : null
}

/** HTTP observations establish resource transfer or endpoint responses. They
 * never establish provider ingestion, property routing, or visitor consent. */
export function runTrackingChecks(meta: PageMetadata | null, evidence: TrackingEvidence | undefined, pageUrl: string,
  native?: Pick<PublicPageSignals, 'hasAnalytics'> | null) {
  const markup = meta?.hasAnalytics ?? native?.hasAnalytics ?? null
  const flags: DeterministicFlag[] = markup === null || evidence?.phase === 'public_action' || evidence?.requests.length ? [] : runMeasurementChecks({ hasAnalytics: markup })
  const assertions: CheckAssertion[] = [{ key: 'analytics-markup', name: 'Analytics configuration in HTML',
    expected: 'An analytics snippet is present in captured HTML', observed: markup === null ? 'Captured HTML markup is unavailable. Snippet presence and absence remain unknown.' : markup ? 'Analytics markup detected; execution and delivery are separate observations.' : 'No snippet detected; runtime, consent-delayed, or proxied analytics may not appear here.',
    passed: markup === true, complete: markup !== null, ...(markup === false && evidence?.requests.length ? { disposition: 'observed' as const } : {}) }]
  const limitation = 'Tracking observations cover recognized endpoints in this browser window. Event requests are suppressed by FixFlags to avoid adding audit traffic. FixFlags does not grant consent to test tracking; an existing action walk may dismiss consent UI. Consent state is not independently established. Service workers are blocked, and embedded-frame traffic is outside the assessed scope. Proxies, other providers, later interactions and provider-recorded events remain unverified.'
  if (!evidence) {
    assertions.push({ key: 'tracking-initiation', name: 'Runtime tracking evidence unavailable', expected: 'Browser request evidence is available',
      observed: 'Only markup was inspected. Library loading, event initiation, destination responses and provider recording remain unknown.', passed: false, complete: false })
    return { flags, assertions, complete: false, limitation }
  }
  if (evidence.phase === 'public_action') assertions.length = 0
  const groups = new Map<string, TrackingRequest[]>()
  for (const request of evidence.requests) {
    const context = trackingContext(request, pageUrl, evidence.captureKey), group = groups.get(context) ?? []
    group.push(request); groups.set(context, group)
  }
  const scope = evidence.phase === 'page_load' ? 'during page loading' : 'during the existing public action walk, including overlay handling'
  const incompletePhase = ' The phase reached its request limit, so additional attempts could have been omitted.'
  let incompleteResponse = false
  function observe(key: string, name: string, expected: string, observed: string, passed: boolean | null, context?: string, descriptive = false, reason?: CheckAssertion['reason']) {
    assertions.push({ key, name, expected, observed, passed: passed === true, complete: passed !== null,
      ...(key === 'tracking-http-response' && passed === true ? { eventResponseQualified: true as const } : {}),
      ...(key === 'tracking-library' && passed === true ? { libraryResponseQualified: true as const } : {}),
      ...(context ? { context } : {}), ...(reason ? { reason } : {}), ...(descriptive ? { disposition: 'observed' as const } : {}) })
  }
  for (const [context, requests] of groups) {
    const first = requests[0], provider = TRACKING_PROVIDERS[first.provider]
    const endpoint = first.hostname + trackingEndpointLabel(first)
    const responder = first.redirected ? `The redirect destination for ${endpoint}` : endpoint
    const responses = requests.map(responseVerdict)
    incompleteResponse ||= requests.some((request, index) => request.state !== 'suppressed' &&
      (responses[index] === null || responses[index] === 'restricted' || request.state === 'pending' ||
        request.role === 'library' && request.state === 'response'))
    const errorStatuses = [...new Set(requests.flatMap((request, index) => responses[index] === false ? [request.status] : []))]
    const restrictedStatuses = [...new Set(requests.flatMap((request, index) => responses[index] === 'restricted' ? [request.status] : []))]
    const failure = errorStatuses.length ? `${responder} returned HTTP ${errorStatuses.join(', ')} ${scope}.` : null
    const successful = responses.every(response => response === true)
    const verdict = failure ? false : successful && !evidence.truncated ? true : null
    const challenge = requests.some(request => request.responseKind === 'challenge')
    const html = requests.some(request => request.responseKind === 'html')
    const missingBody = requests.find(libraryResponseWithoutFullBody)
    const empty = requests.some(request => request.responseKind === 'empty')
    const scriptMime = requests.some(request => request.responseKind === 'script_mime')
    const unavailable = challenge ? `${responder} presented an access challenge ${scope}. The normal response remains unknown.`
      : restrictedStatuses.length ? `${responder} returned HTTP ${restrictedStatuses.join(', ')} ${scope}. Access restrictions leave the normal response unknown.`
      : html ? `${responder} returned HTML ${scope}. ${first.role === 'library' ? 'A successful library transfer was not established.' : 'The event endpoint response remains unverified.'}`
      : missingBody ? `${responder} returned HTTP ${missingBody.status} ${scope}. A fresh, complete library transfer remains unverified.`
      : empty ? `${responder} returned an empty response ${scope}. A successful library transfer was not established.`
      : scriptMime ? `${responder} declared a response type that the browser's nosniff policy blocks for scripts ${scope}.` : null
    if (first.role === 'library') {
      const observed = failure ?? unavailable ?? (successful
        ? `${responder} completed its recorded transfers ${scope}.${evidence.truncated ? incompletePhase : ' This does not prove library initialization or tracking delivery.'}`
        : `${endpoint} was requested ${scope}, but successful transfer was not established. Browser blocking, transport failures or the observation limit may affect this result.`)
      observe('tracking-library', `${provider}: library resource`, 'The requested library resource completes without an HTTP error',
        observed, verdict, context)
    } else {
      observe('tracking-initiation', `${provider}: event request initiated`, 'An event collection request is initiated by the page',
        `${requests.length} request attempt${requests.length === 1 ? '' : 's'} to ${endpoint} ${scope}. Payloads, identifiers and event values were not retained.`, true, context, true)
      const suppressed = requests.filter(request => request.state === 'suppressed').length
      const observed = failure ?? unavailable ?? (successful
        ? `${endpoint} returned a successful HTTP response ${scope}.${evidence.truncated ? incompletePhase : ' This establishes an endpoint response, not provider ingestion.'}`
        : suppressed ? `${suppressed} attempt${suppressed === 1 ? ' was' : 's were'} intentionally stopped by FixFlags before delivery. Destination availability and provider recording remain unknown.`
          : 'No conclusive destination response was recorded. Browser restrictions, consent policy or the observation window may affect this result.')
      observe('tracking-http-response', `${provider}: destination response`, 'The event destination returns a successful HTTP response', observed,
        verdict, context, false, !failure && !unavailable && !successful && suppressed ? 'tracking_suppressed' : undefined)
      observe('tracking-provider-recording', `${provider}: provider recording`, 'The provider independently confirms the relevant event was recorded',
        'No independent event-level provider confirmation was obtained. HTTP responses and aggregate audience reports do not certify that this event was recorded.', null, context, false, 'tracking_provider_unverified')
    }
    if (failure) {
      const checkId = first.role === 'library' ? 'tracking-library-http-error' : 'tracking-endpoint-http-error'
      flags.push({ checkId, rubric: 'REACH', impactTag: 'MEASUREMENT', severity: 'IMPORTANT',
        problem: first.role === 'library' ? 'A requested tracking library returned an HTTP error' : 'A tracking destination returned an HTTP error',
        evidence: `${provider}: ${failure} This is the observed browser response; consent, bot restrictions and proxy policy may differ for normal visitors.`,
        fix: '1. Check the recorded endpoint URL, deployment and provider configuration.\n2. Inspect the same request for a normal visitor under the intended consent policy.\n3. Resolve the HTTP error without bypassing consent or intentional access restrictions.\n4. Repeat the same browser scope. Separately confirm provider ingestion and the intended property when authorized.',
        confidence: 0.95, source: 'DETERMINISTIC', pageUrl,
        verificationRule: isComparableTrackingContext(context) ? TRACKING_VERIFICATION_RULE
          : 'Tracking observation: the request was recorded without the conditions required for comparable repair verification.',
        evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: `${provider}: ${endpoint}`, context }] })
    }
  }
  if (!evidence.requests.some(request => request.role === 'library')) observe('tracking-library', 'Library loading not established',
    'Browser evidence establishes a recognized tracking library transfer',
    evidence.libraryObservationUnavailable ? 'The browser could not collect library transfer evidence in this observation.'
      : 'No recognized external library transfer was observed. Inline or bundled code, consent, intentional blocking, unsupported providers and proxies remain possible.',
    null, undefined, false, 'tracking_no_library')
  if (!evidence.requests.some(request => request.role === 'event')) observe('tracking-initiation', 'Event initiation not established',
    'Browser evidence establishes relevant event requests', `${scope}: no recognized event collection request was observed. Consent, intentional blocking, unsupported or proxied providers, and delayed execution can explain this. No missing-event failure is inferred.`, null, undefined, false, 'tracking_no_event')
  if (!evidence.requests.some(request => request.role === 'event')) {
    observe('tracking-http-response', 'Tracking destination remains unverified', 'The event destination provides an observable response', 'No event-level destination response was established in this scope.', null)
    observe('tracking-provider-recording', 'Provider recording remains unverified', 'Independent provider evidence confirms relevant events', 'No independent event-level confirmation was obtained. Aggregate audience reports are separate evidence.', null, undefined, false, 'tracking_provider_unverified')
  }
  // Retain all endpoint scopes before the existing finding collapse runs.
  const grouped = new Map<string, DeterministicFlag>()
  for (const flag of flags) {
    const prior = grouped.get(flag.checkId)
    if (!prior) grouped.set(flag.checkId, flag)
    else { prior.evidence += '\n' + flag.evidence; prior.evidenceTargets = [...(prior.evidenceTargets ?? []), ...(flag.evidenceTargets ?? [])] }
  }
  return { flags: [...grouped.values()], assertions,
    complete: (evidence.phase === 'public_action' || markup !== null) && !evidence.truncated && !evidence.libraryObservationUnavailable && !incompleteResponse,
    limitation: `${evidence.durationMs}ms browser observation. ${evidence.truncated ? 'The request limit was reached. ' : ''}${limitation}` }
}
