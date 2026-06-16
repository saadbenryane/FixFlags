import { AuditSource } from '@prisma/client'
import { normalizeDomain } from '@/lib/leads/normalize-domain'

export interface AuditAttribution {
  normalizedDomain: string | null
  source: AuditSource
  referrer: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export function inferAuditSource(pathname: string | null | undefined): AuditSource {
  if (!pathname) return 'UNKNOWN'
  if (pathname === '/' || pathname.startsWith('/#')) return 'HOMEPAGE'
  if (pathname.startsWith('/dashboard')) return 'DASHBOARD'
  if (pathname.startsWith('/api/mcp')) return 'MCP'
  if (pathname.startsWith('/api/')) return 'API'
  return 'UNKNOWN'
}

export function parseAuditAttribution(input: {
  url: string
  referer?: string | null
  pathname?: string | null
  searchParams?: URLSearchParams
}): AuditAttribution {
  const normalizedDomain = normalizeDomain(input.url)
  const referrer = input.referer?.trim() || null
  const searchParams = input.searchParams

  return {
    normalizedDomain,
    source: inferAuditSource(input.pathname),
    referrer,
    utmSource: searchParams?.get('utm_source')?.trim() || null,
    utmMedium: searchParams?.get('utm_medium')?.trim() || null,
    utmCampaign: searchParams?.get('utm_campaign')?.trim() || null,
  }
}
