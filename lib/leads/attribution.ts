import { AuditSource } from '@prisma/client'
import { normalizeDomain } from '@/lib/leads/normalize-domain'

export interface AuditAttribution {
  normalizedDomain: string | null
  source: AuditSource
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  gclid: string | null
  fbclid: string | null
}

const CLIENT_SOURCES = new Set<AuditSource>([
  'HOMEPAGE',
  'DASHBOARD',
  'REPORT',
  'API',
  'MCP',
  'UNKNOWN',
])

export function inferAuditSource(pathname: string | null | undefined): AuditSource {
  if (!pathname) return 'UNKNOWN'
  if (pathname === '/' || pathname.startsWith('/#')) return 'HOMEPAGE'
  if (pathname.startsWith('/dashboard')) return 'DASHBOARD'
  if (pathname.startsWith('/report') || pathname.startsWith('/audit')) return 'REPORT'
  if (pathname.startsWith('/pricing')) return 'UNKNOWN'
  if (pathname.startsWith('/api/mcp')) return 'MCP'
  if (pathname.startsWith('/api/')) return 'API'
  return 'UNKNOWN'
}

export function buildAttribution(input: {
  url: string
  source?: AuditSource
  referer?: string | null
  pathname?: string | null
  searchParams?: URLSearchParams
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  gclid?: string | null
  fbclid?: string | null
}): AuditAttribution {
  const normalizedDomain = normalizeDomain(input.url)
  const searchParams = input.searchParams

  const utmSource =
    input.utmSource?.trim() ||
    searchParams?.get('utm_source')?.trim() ||
    null
  const utmMedium =
    input.utmMedium?.trim() ||
    searchParams?.get('utm_medium')?.trim() ||
    null
  const utmCampaign =
    input.utmCampaign?.trim() ||
    searchParams?.get('utm_campaign')?.trim() ||
    null
  const gclid =
    input.gclid?.trim() ||
    searchParams?.get('gclid')?.trim() ||
    null
  const fbclid =
    input.fbclid?.trim() ||
    searchParams?.get('fbclid')?.trim() ||
    null

  const source =
    input.source ??
    inferAuditSource(input.pathname)

  return {
    normalizedDomain,
    source,
    referrer: input.referer?.trim() || null,
    utmSource,
    utmMedium,
    utmCampaign,
    gclid,
    fbclid,
  }
}

export function parseAuditAttribution(input: {
  url: string
  referer?: string | null
  pathname?: string | null
  searchParams?: URLSearchParams
}): AuditAttribution {
  return buildAttribution(input)
}

export function parseClientAuditSource(raw: string | undefined): AuditSource | undefined {
  if (!raw) return undefined
  const upper = raw.toUpperCase() as AuditSource
  return CLIENT_SOURCES.has(upper) ? upper : undefined
}
