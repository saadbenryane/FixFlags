import type { Page, Response } from 'playwright'

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
  dispose: () => void
}

const MAX_FAILURES = 40

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
  let originHost = ''
  try {
    originHost = new URL(pageOrigin).hostname
  } catch {
    originHost = ''
  }

  const onResponse = (response: Response) => {
    if (failures.length >= MAX_FAILURES) return
    const status = response.status()
    if (status < 400) return

    const request = response.request()
    const resourceType = request.resourceType()
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

  page.on('response', onResponse)

  return {
    failures,
    dispose: () => {
      page.off('response', onResponse)
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
