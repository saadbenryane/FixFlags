import type { Page, Request, Response } from 'playwright'
import { classifyBrowserTrackingRequest } from '../tracking/endpoints'
import { MAX_TRACKING_REQUESTS, type TrackingEvidence, type TrackingRequest } from '../tracking/contracts'
import { trackingRedirectKey, trackingRequestKey } from '../tracking/identity'
import { primaryActionControlKey } from '../flow/action-context'
import { auditPageObservation, captureObservationKey } from './observation-scope'
import { MAX_ENGAGEMENT_REQUESTS, type EngagementEvidence, type EngagementRequest } from '../network-engagement-evidence'
import { displayDestination } from '../checks/destination-evidence'
import { isBotInterstitialPage } from './page-capture'
import { normalizeSiteHost } from '@/lib/utils/url-helpers'
import { observeNativeLibraries, recordedTrackingMethod } from './native-library-observation'
import type { NativeSession } from './native-session'

export interface NetworkFailureRecord {
  url: string
  method: string
  status: number
  resourceType: string
  sameOrigin: boolean
  engagementPath: boolean
  engagementPhase?: TrackingRequest['phase']
  requestKey?: string
  at: number
}

export interface NetworkMonitor {
  failures: NetworkFailureRecord[]
  resources: TechnologyResourceRecord[]
  resourcesTruncated: () => boolean
  tracking: (phase?: TrackingRequest['phase']) => TrackingEvidence
  engagement: (phase?: TrackingRequest['phase']) => EngagementEvidence
  settleNetwork: (deadline: number, scope: { engagement?: TrackingRequest['phase'] | 'all'; tracking?: TrackingRequest['phase']; signal?: AbortSignal }) => Promise<void>
  setTrackingPhase: (phase: TrackingRequest['phase']) => void
  setPublicActionControl: (context: string | null) => void
  markNavigationChallenge: (request: Request) => void
  suppressTracking: (request: Request) => void
  observeLibraries: (channel: NativeSession, mainFrameId: string) => Promise<void>
  dispose: () => void
}

const MAX_FAILURES = 40
export const MAX_TECHNOLOGY_RESOURCES = 300
const MAX_RESOURCE_PATH_LENGTH = 240

export interface TechnologyResourceRecord {
  hostname: string
  pathname: string
  resourceType: string
  status: number
}

export function sanitizeTechnologyResource(
  url: string,
  resourceType: string,
  status: number
): TechnologyResourceRecord | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return {
      hostname: parsed.hostname.toLowerCase().slice(0, 253),
      pathname: (parsed.pathname || '/').slice(0, MAX_RESOURCE_PATH_LENGTH),
      resourceType: resourceType.slice(0, 32),
      status,
    }
  } catch {
    return null
  }
}

/** Third-party noise we never promote to Flags. */
const NOISE_HOST_PATTERN =
  /(?:^|\.)(?:doubleclick\.net|googlesyndication\.com|googleadservices\.com|adservice\.google|facebook\.net|fbcdn\.net|rlcdn\.com|amazon-adsystem\.com|adnxs\.com|criteo\.com|scorecardresearch\.com|hotjar\.com|fullstory\.com|segment\.io|sentry\.io|cloudflareinsights\.com|challenges\.cloudflare\.com)$/i

const ENGAGEMENT_PATH_PATTERN =
  /newsletter|subscribe|signup|sign-up|register|contact|checkout|cart|login|auth|account|demo|waitlist|join/i

function isNoiseHost(hostname: string): boolean {
  return NOISE_HOST_PATTERN.test(hostname)
}

export function isEngagementPath(pathname: string): boolean {
  return ENGAGEMENT_PATH_PATTERN.test(pathname)
}

function explicitlyAcceptsHtml(request: Request, mediaType: string): boolean {
  return (request.headers().accept ?? '').split(',').some(value => {
    const [type, ...parameters] = value.toLowerCase().split(';').map(part => part.trim())
    return type === mediaType && !parameters.some(parameter => /^q\s*=\s*0(?:\.0*)?$/.test(parameter))
  })
}

/** Keep a tracking library's private redirect path out of technology evidence. */
function resourceTrackingEndpoint(request: Request, pageOrigin: string) {
  const direct = classifyBrowserTrackingRequest(request, pageOrigin)
  if (direct || request.resourceType() !== 'script') return direct
  for (let source = request.redirectedFrom?.(), hop = 0; source && hop < 20; source = source.redirectedFrom(), hop++) {
    const endpoint = classifyBrowserTrackingRequest(source, pageOrigin)
    if (endpoint?.role === 'library') return endpoint
  }
  return null
}

export function attachNetworkMonitor(page: Page, pageOrigin: string): NetworkMonitor {
  const failures: NetworkFailureRecord[] = []
  const resources: TechnologyResourceRecord[] = []
  const resourceKeys = new Set<string>()
  let technologyResourcesTruncated = false
  const startedAt = Date.now()
  const trackingPhases: Record<TrackingRequest['phase'], { requests: TrackingRequest[]; truncated: boolean }> = {
    page_load: { requests: [], truncated: false }, public_action: { requests: [], truncated: false },
  }
  const tracked = new WeakMap<Request, TrackingRequest>()
  const engagementPhases: Record<TrackingRequest['phase'], { requests: EngagementRequest[]; truncated: boolean }> = {
    page_load: { requests: [], truncated: false }, public_action: { requests: [], truncated: false },
  }
  const engagementTracked = new WeakMap<Request, { phase: TrackingRequest['phase']; observation?: EngagementRequest; failure?: NetworkFailureRecord }>()
  const evidenceWaiters = new Set<() => void>()
  const evidenceChanged = () => { for (const changed of evidenceWaiters) changed() }
  let disposed = false
  let disposeLibraries: (() => void) | undefined
  let libraryObservationUnavailable = false
  let phase: TrackingRequest['phase'] = 'page_load'
  let actionKey: string | undefined
  const phaseStarts: Partial<Record<TrackingRequest['phase'], number>> = { page_load: startedAt }
  const admitted = URL.canParse(pageOrigin) ? new URL(pageOrigin) : null
  const siteHost = admitted ? normalizeSiteHost(admitted.hostname) : null
  const captureKey = (documentUrl?: string) => {
    const observation = auditPageObservation(page)
    if (!observation || observation.restricted) return undefined
    const current = observation.scope.finalUrl
    // Native document identity can arrive before the Playwright navigation
    // update. Preserve the live fragment when both identify the same document.
    const finalUrl = documentUrl && documentUrl.split('#', 1)[0] !== current.split('#', 1)[0] ? documentUrl : current
    const key = /^https?:/.test(finalUrl) && URL.canParse(finalUrl)
      ? captureObservationKey({ ...observation.scope, finalUrl }) : undefined
    return key === 'unknown' ? undefined : key
  }
  const registerTracking = (endpoint: NonNullable<ReturnType<typeof classifyBrowserTrackingRequest>>, url: string, method: string,
    sourceScope?: string) => {
    const current = trackingPhases[phase]
    if (current.requests.length >= MAX_TRACKING_REQUESTS) { current.truncated = true; return }
    const record: TrackingRequest & { requestKey: string } = { ...endpoint, method: recordedTrackingMethod(method),
      requestKey: trackingRequestKey(url, method), actionKey: sourceScope && phase === 'public_action' ? actionKey : undefined,
      captureKey: sourceScope, phase, state: 'pending', status: null, reason: null, atMs: Math.max(0, Date.now() - (phaseStarts[phase] ?? startedAt)) }
    current.requests.push(record)
    return record
  }
  const isEngagementRequest = (request: Request, url: URL, source?: Request | null) => {
    if (!siteHost || normalizeSiteHost(url.hostname) !== siteHost ||
      !['http:', 'https:'].includes(url.protocol) || !['xhr', 'fetch', 'document'].includes(request.resourceType())) return false
    try {
      if (request.frame() !== page.mainFrame()) return false
      if (source && engagementTracked.has(source)) return url.origin === new URL(source.url()).origin
      const document = new URL(page.url())
      return isEngagementPath(url.pathname) && url.origin === (document.href === 'about:blank' ? admitted?.origin : document.origin)
    } catch { return false }
  }
  const onRequest = (request: Request) => {
    const endpoint = classifyBrowserTrackingRequest(request, pageOrigin)
    const url = request.url(), method = request.method().toUpperCase()
    const source = request.redirectedFrom?.()
    const initiatingAction = phase === 'public_action' && !source ? actionKey : undefined
    if (!endpoint && !engagementTracked.has(request) && URL.canParse(url) && isEngagementRequest(request, new URL(url), source)) {
      const prior = source && engagementTracked.get(source)
      const requestPhase = prior ? prior.phase : phase
      const current = engagementPhases[requestPhase]
      if (source && prior?.observation) {
        const observed = prior.observation
        observed.redirectKey = trackingRedirectKey(observed.redirectKey ?? observed.requestKey, url, method)
        observed.requestKey = trackingRequestKey(url, method)
        observed.method = method.slice(0, 32)
        if (isEngagementPath(new URL(url).pathname)) observed.destination = displayDestination(url)
        observed.status = null; observed.state = 'pending'; delete observed.responseKind
        engagementTracked.delete(source)
        engagementTracked.set(request, prior)
      } else if (current.requests.length >= MAX_ENGAGEMENT_REQUESTS) {
        current.truncated = true
        engagementTracked.set(request, { phase: requestPhase })
      } else {
        // An unobserved redirect source cannot establish the initiating scope.
        const observed: EngagementRequest = { requestKey: trackingRequestKey(url, method),
          captureKey: source ? undefined : captureKey(), actionKey: initiatingAction,
          method: method.slice(0, 32), destination: displayDestination(url),
          phase: requestPhase, status: null, state: 'pending' }
        engagementTracked.set(request, { phase: requestPhase, observation: observed }); current.requests.push(observed)
      }
    }
    if (tracked.has(request) || endpoint?.role !== 'event' || ['HEAD', 'OPTIONS'].includes(method)) return
    try { if (request.frame() !== page.mainFrame()) return } catch { return }
    const record = registerTracking(endpoint, url, method, source ? undefined : captureKey())
    if (record) tracked.set(request, record)
  }
  const onFinished = (request: Request) => {
    const engagement = engagementTracked.get(request)?.observation
    if (engagement && !(engagement.state === 'pending' && engagement.status !== null)) {
      engagement.state = 'completed'; evidenceChanged()
    }
    const record = tracked.get(request)
    if (!record || record.state === 'suppressed') return
    record.state = 'completed'
    evidenceChanged()
  }
  const onFailed = (request: Request) => {
    const engagement = engagementTracked.get(request)?.observation
    if (engagement) { engagement.state = 'failed'; evidenceChanged() }
    const record = tracked.get(request)
    if (!record || record.state === 'suppressed') return
    record.state = 'failed'
    // Browser errors can contain sensitive URLs. Only retain a coarse cause.
    record.reason = /ERR_BLOCKED_BY_CLIENT|ERR_FAILED/i.test(request.failure()?.errorText ?? '') ? 'browser_blocked' : 'transport_failed'
    evidenceChanged()
  }
  const onResponse = (response: Response) => {
    const request = response.request()
    const resourceType = request.resourceType()
    const headers = response.headers()
    const status = response.status()
    const awaitsRedirect = Boolean(headers.location) && [301, 302, 303, 307, 308].includes(status)
    const mediaType = headers['content-type']?.split(';', 1)[0].trim().toLowerCase()
    const html = mediaType === 'text/html' || mediaType === 'application/xhtml+xml'
    const successful = status >= 200 && status < 300
    const challenge = isBotInterstitialPage({ cfMitigated: headers['cf-mitigated'] })
    const admission = engagementTracked.get(request)
    const engagement = admission?.observation
    if (engagement) {
      engagement.status = status
      engagement.state = awaitsRedirect ? 'pending' : 'response'
      if (challenge) engagement.responseKind = 'challenge'
      else if (successful && html && resourceType !== 'document' && status !== 204 && status !== 205 &&
        request.method().toUpperCase() !== 'HEAD' && !explicitlyAcceptsHtml(request, mediaType))
        engagement.responseKind = 'unexpected_html'
    }
    const tracking = tracked.get(request)
    if (tracking && tracking.state !== 'suppressed') {
      tracking.status = status
      tracking.state = 'response'
      if (challenge) tracking.responseKind = 'challenge'
      else if (successful) {
        if (html && status !== 204 && status !== 205) tracking.responseKind = 'html'
        else if (status !== 206) tracking.eventResponseQualified = true
      }
    }
    if (engagement) evidenceChanged()
    const endpoint = tracking ?? resourceTrackingEndpoint(request, pageOrigin)
    const resource = sanitizeTechnologyResource(response.url(), resourceType, status)
    if (resource) {
      if (endpoint) resource.pathname = endpoint.endpoint
      const key = `${resource.resourceType}:${resource.hostname}${resource.pathname}`
      if (!resourceKeys.has(key) && resources.length < MAX_TECHNOLOGY_RESOURCES) {
        resourceKeys.add(key)
        resources.push(resource)
      } else if (!resourceKeys.has(key)) {
        technologyResourcesTruncated = true
      }
    }

    if (endpoint || failures.length >= MAX_FAILURES) return
    if (status < 400) return

    if (resourceType !== 'xhr' && resourceType !== 'fetch' && resourceType !== 'document') {
      return
    }

    if (!URL.canParse(response.url())) return
    const url = new URL(response.url())
    if (isNoiseHost(url.hostname)) return
    const failure: NetworkFailureRecord = {
      url: admission && !isEngagementPath(url.pathname) ? admission.observation?.destination ?? url.origin : response.url().slice(0, 500),
      method: request.method(),
      status,
      resourceType,
      sameOrigin: url.origin === admitted?.origin || Boolean(admission),
      engagementPath: Boolean(admission) && !challenge,
      engagementPhase: admission?.phase,
      requestKey: admission?.observation && (admission.observation.redirectKey ?? admission.observation.requestKey),
      at: Date.now(),
    }
    failures.push(failure)
    if (admission) admission.failure = failure
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfinished', onFinished)
  page.on('requestfailed', onFailed)

  return {
    failures,
    resources,
    resourcesTruncated: () => technologyResourcesTruncated,
    engagement: selected => {
      const phases = selected ? [engagementPhases[selected]] : Object.values(engagementPhases)
      const requests = phases.flatMap(item => item.requests)
      return { version: 3, requests: requests.slice(0, MAX_ENGAGEMENT_REQUESTS).map(request => ({ ...request })),
        truncated: requests.length > MAX_ENGAGEMENT_REQUESTS || phases.some(item => item.truncated) }
    },
    async settleNetwork(deadline, { engagement, tracking, signal }) {
      if (signal?.aborted || disposed || Date.now() >= deadline) return
      const phases = engagement === 'all' ? Object.values(engagementPhases) : engagement ? [engagementPhases[engagement]] : []
      // Follow the transfers already started in this phase, including their
      // redirect hops. A later request must not extend the observation window.
      const engagements = phases.flatMap(item => item.requests)
      const libraries = tracking ? trackingPhases[tracking].requests.filter(request => request.role === 'library') : []
      const pending = () => engagements.some(request => request.state === 'pending' ||
        request.state === 'response' && request.captureKey && !request.responseKind && request.status !== null && request.status >= 200 && request.status < 300) ||
        libraries.some(request => !request.responseKind && (request.state === 'pending' || request.state === 'response' &&
          request.status !== null && request.status >= 200 && request.status < 300))
      if (!pending()) return
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); evidenceWaiters.delete(changed); signal?.removeEventListener('abort', done); resolve() }
        const changed = () => { if (disposed || !pending()) done() }
        const timer = setTimeout(done, Math.max(1, Math.min(4000, deadline - Date.now())))
        evidenceWaiters.add(changed)
        signal?.addEventListener('abort', done, { once: true })
        if (signal?.aborted) done()
        else changed()
      })
    },
    tracking: (selected = phase) => ({ version: 1, phase: selected,
      requests: trackingPhases[selected].requests.map(record => ({ ...record })),
      ...(libraryObservationUnavailable ? { libraryObservationUnavailable: true as const } : {}),
      truncated: trackingPhases[selected].truncated, durationMs: Math.max(0, Date.now() - (phaseStarts[selected] ?? Date.now())),
      consentInteraction: selected === 'page_load' ? 'none' : 'existing_flow' }),
    setTrackingPhase: value => {
      phase = value; phaseStarts[value] ??= Date.now()
    },
    setPublicActionControl: context => { actionKey = primaryActionControlKey(context) },
    markNavigationChallenge: request => {
      const admission = engagementTracked.get(request)
      if (admission?.observation) admission.observation.responseKind = 'challenge'
      if (admission?.failure) admission.failure.engagementPath = false
    },
    suppressTracking: request => {
      if (!tracked.has(request)) onRequest(request)
      const record = tracked.get(request)
      if (record) { record.state = 'suppressed'; record.reason = 'scanner_suppressed' }
    },
    observeLibraries: async (channel, mainFrameId) => {
      try {
        const dispose = await observeNativeLibraries(channel, mainFrameId, pageOrigin,
          (endpoint, url, method, documentUrl) => registerTracking(endpoint, url, method, documentUrl ? captureKey(documentUrl) : undefined),
          evidenceChanged)
        if (disposed) dispose()
        else disposeLibraries = dispose
      } catch { libraryObservationUnavailable = true }
    },
    dispose: () => {
      disposed = true
      disposeLibraries?.()
      evidenceChanged()
      page.off('request', onRequest)
      page.off('response', onResponse)
      page.off('requestfinished', onFinished)
      page.off('requestfailed', onFailed)
    },
  }
}
