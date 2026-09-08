import {
  canonicalProductHost,
  canonicalProductUrl,
} from '@/lib/audit/product-intelligence'

export type SiteRef =
  | { kind: 'project'; siteId: string; projectId: string }
  | { kind: 'provisional'; siteId: string; provisionalSiteId: string }

export type SiteRefInput =
  | { kind: 'project'; projectId: string }
  | { kind: 'provisional'; provisionalSiteId: string }

export function encodeSiteId(ref: SiteRefInput): string {
  if (ref.kind === 'project') return ref.projectId
  return `p_${ref.provisionalSiteId}`
}

export function parseSiteId(siteId: string): SiteRef | null {
  const trimmed = siteId.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('p_')) {
    const provisionalSiteId = trimmed.slice(2)
    if (!provisionalSiteId) return null
    return { kind: 'provisional', siteId: trimmed, provisionalSiteId }
  }
  return { kind: 'project', siteId: trimmed, projectId: trimmed }
}

export function siteUrlParts(url: string): { canonicalHost: string; canonicalUrl: string } | null {
  const canonicalHost = canonicalProductHost(url)
  if (!canonicalHost) return null
  return { canonicalHost, canonicalUrl: canonicalProductUrl(url) }
}

export type SiteRecord = {
  siteId: string
  kind: 'project' | 'provisional'
  url: string
  canonicalHost: string
  name: string
  projectId: string | null
  provisionalSiteId: string | null
  primaryAuditId: string | null
  watchInterval: 'weekly' | 'daily' | null
  watchNextRunAt: Date | null
  watchLastRunAt: Date | null
  userId: string | null
}
