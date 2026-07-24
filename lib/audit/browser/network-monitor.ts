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
  resources: TechnologyResourceRecord[]
  resourcesTruncated: () => boolean
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
  let originHost = ''
  try {
    originHost = new URL(pageOrigin).hostname
  } catch {
    originHost = ''
  }

  const onResponse = (response: Response) => {
    const request = response.request()
    const resourceType = request.resourceType()
    const resource = sanitizeTechnologyResource(response.url(), resourceType, response.status())
    if (resource) {
      const key = `${resource.resourceType}:${resource.hostname}${resource.pathname}`
      if (!resourceKeys.has(key) && resources.length < MAX_TECHNOLOGY_RESOURCES) {
        resourceKeys.add(key)
        resources.push(resource)
      } else if (!resourceKeys.has(key)) {
        technologyResourcesTruncated = true
      }
    }

    if (failures.length >= MAX_FAILURES) return
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

  page.on('response', onResponse)

  return {
    failures,
    resources,
    resourcesTruncated: () => technologyResourcesTruncated,
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
