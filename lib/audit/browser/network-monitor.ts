import type { Page, Request, Response } from 'playwright'
import { classifyTrackingEndpoint } from '../tracking/endpoints'
import { MAX_TRACKING_REQUESTS, type TrackingEvidence, type TrackingRequest } from '../tracking/contracts'

export interface NetworkFailureRecord {
  url: string
  method: string
  status: number
  resourceType: string
  sameOrigin: boolean
  engagementPath: boolean
  at: number
}

export interface NetworkMonitor {
  failures: NetworkFailureRecord[]
  resources: TechnologyResourceRecord[]
  resourcesTruncated: () => boolean
  tracking: (phase?: TrackingRequest['phase']) => TrackingEvidence
  setTrackingPhase: (phase: TrackingRequest['phase']) => void
  suppressTracking: (request: Request) => void
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

export function attachNetworkMonitor(page: Page, pageOrigin: string): NetworkMonitor {
  const failures: NetworkFailureRecord[] = []
  const resources: TechnologyResourceRecord[] = []
  const resourceKeys = new Set<string>()
  let technologyResourcesTruncated = false
  const startedAt = Date.now(), trackingRequests: TrackingRequest[] = []
  const tracked = new WeakMap<Request, TrackingRequest>()
  let phase: TrackingRequest['phase'] = 'page_load', trackingTruncated = false
  const phaseStarts: Partial<Record<TrackingRequest['phase'], number>> = { page_load: startedAt }
  const onRequest = (request: Request) => {
    const endpoint = classifyTrackingEndpoint(request.url(), request.resourceType(), pageOrigin)
    if (!endpoint || endpoint.role === 'event' && ['HEAD', 'OPTIONS'].includes(request.method())) return
    try { if (request.frame() !== page.mainFrame()) return } catch { return }
    if (trackingRequests.length >= MAX_TRACKING_REQUESTS) { trackingTruncated = true; return }
    const method = request.method().toUpperCase()
    const record: TrackingRequest = { ...endpoint, method: ['GET', 'HEAD', 'OPTIONS', 'POST'].includes(method) ? method as TrackingRequest['method'] : 'OTHER',
      phase, state: 'pending', status: null, reason: null, atMs: Math.max(0, Date.now() - (phaseStarts[phase] ?? startedAt)) }
    tracked.set(request, record); trackingRequests.push(record)
  }
  const onFinished = (request: Request) => {
    const record = tracked.get(request)
    if (record && record.state !== 'suppressed') record.state = 'completed'
  }
  const onFailed = (request: Request) => {
    const record = tracked.get(request)
    if (!record || record.state === 'suppressed') return
    record.state = 'failed'
    // Browser errors can contain sensitive URLs. Only retain a coarse cause.
    record.reason = /ERR_BLOCKED_BY_CLIENT|ERR_FAILED/i.test(request.failure()?.errorText ?? '') ? 'browser_blocked' : 'transport_failed'
  }
  let originHost = ''
  try {
    originHost = new URL(pageOrigin).hostname
  } catch {
    originHost = ''
  }

  const onResponse = (response: Response) => {
    const request = response.request()
    const resourceType = request.resourceType()
    const tracking = tracked.get(request)
    if (tracking && tracking.state !== 'suppressed') { tracking.status = response.status(); tracking.state = 'response' }
    const resource = sanitizeTechnologyResource(response.url(), resourceType, response.status())
    if (resource) {
      const endpoint = classifyTrackingEndpoint(response.url(), resourceType, pageOrigin)
      if (endpoint) resource.pathname = endpoint.endpoint
      const key = `${resource.resourceType}:${resource.hostname}${resource.pathname}`
      if (!resourceKeys.has(key) && resources.length < MAX_TECHNOLOGY_RESOURCES) {
        resourceKeys.add(key)
        resources.push(resource)
      } else if (!resourceKeys.has(key)) {
        technologyResourcesTruncated = true
      }
    }

    if (tracking || classifyTrackingEndpoint(response.url(), resourceType, pageOrigin) || failures.length >= MAX_FAILURES) return
    const status = response.status()
    if (status < 400) return

    if (resourceType !== 'xhr' && resourceType !== 'fetch' && resourceType !== 'document') {
      return
    }

    let hostname = ''
    let pathname = ''
    try {
      const u = new URL(response.url())
      hostname = u.hostname
      pathname = u.pathname
    } catch {
      return
    }

    if (isNoiseHost(hostname)) return

    const sameOrigin = Boolean(originHost) && hostname === originHost
    failures.push({
      url: response.url().slice(0, 500),
      method: request.method(),
      status,
      resourceType,
      sameOrigin,
      engagementPath: isEngagementPath(pathname),
      at: Date.now(),
    })
  }

  page.on('request', onRequest)
  page.on('response', onResponse)
  page.on('requestfinished', onFinished)
  page.on('requestfailed', onFailed)

  return {
    failures,
    resources,
    resourcesTruncated: () => technologyResourcesTruncated,
    tracking: (selected = phase) => ({ version: 1, phase: selected,
      requests: trackingRequests.filter(record => record.phase === selected).map(record => ({ ...record })),
      truncated: trackingTruncated, durationMs: Math.max(0, Date.now() - (phaseStarts[selected] ?? Date.now())),
      consentInteraction: selected === 'page_load' ? 'none' : 'existing_flow' }),
    setTrackingPhase: value => { phase = value; phaseStarts[value] ??= Date.now() },
    suppressTracking: request => {
      if (!tracked.has(request)) onRequest(request)
      const record = tracked.get(request)
      if (record) { record.state = 'suppressed'; record.reason = 'scanner_suppressed' }
    },
    dispose: () => {
      page.off('request', onRequest)
      page.off('response', onResponse)
      page.off('requestfinished', onFinished)
      page.off('requestfailed', onFailed)
    },
  }
}

export function formatNetworkFailuresForEvidence(
  failures: NetworkFailureRecord[],
  limit = 5
): string {
  return failures
    .slice(0, limit)
    .map((f) => `${f.method} ${f.status} ${f.url}`)
    .join('; ')
}
