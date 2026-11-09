import type { Prisma } from '@prisma/client'
import { baseCheckId } from '@/lib/audit/check-identity'
import { isPermittedPublicResearchCheck } from '@/lib/graph/public-research'
import { parseSiteHostname } from '@/lib/utils/url-helpers'
import { consentView, researchAuditMatchesSite, type ResearchConsentSite } from './research-consent'

/** Establish the recorded access boundary without loading credential material. */
export const publicResearchAuditAccess = {
  scanAccessEncrypted: null,
  AND: [
    { executionSpec: { path: ['version'], equals: 1 } },
    { executionSpec: { path: ['environment'], equals: 'production' } },
    { executionSpec: { path: ['scanAccess', 'kind'], equals: 'public' } },
  ],
  OR: ['SITE', 'CATEGORY', 'OUTCOMES', 'DIAGNOSTIC'].map(scope => ({
    executionSpec: { path: ['scope'], equals: scope },
  })),
} satisfies Prisma.AuditWhereInput

type ResearchGrant = { id: string; userId: string | null; version: number; properties: unknown; createdAt: Date }
type ResearchAudit = {
  id: string; projectId: string | null; userId: string | null; url: string; status: string
  createdAt: Date; completedAt: Date | null
}
export type ResearchFlag = {
  id: string; auditId: string; checkId: string | null; source: string; confidence: number; createdAt: Date
}

export function hasScopedResearchGrant(project: ResearchConsentSite, grant: ResearchGrant) {
  return researchAuditMatchesSite(project.url, project.url) && consentView(grant, project).enabled
}

export function researchPublicTargetMatchesSite(siteUrl: string, targetUrl: string) {
  if (!researchAuditMatchesSite(siteUrl, targetUrl)) return false
  // A URL may carry its own access token outside the scan-access configuration.
  const address = new URL(targetUrl)
  return !address.search && !address.hash
}

/** Callers establish a current grant before using its prospective time boundary. */
export function permittedResearchAuditHostname(
  project: Pick<ResearchConsentSite, 'id' | 'userId' | 'url'>, grant: ResearchGrant, audit: ResearchAudit, window: { start: Date; end: Date },
) {
  if (audit.projectId !== project.id || audit.userId !== project.userId || audit.status !== 'COMPLETED' ||
    !audit.completedAt || audit.completedAt < audit.createdAt || audit.createdAt < grant.createdAt ||
    audit.createdAt < window.start || audit.completedAt > window.end ||
    !researchPublicTargetMatchesSite(project.url, audit.url)) return null
  return parseSiteHostname(audit.url).toLowerCase().replace(/\.$/, '') || null
}

export function countResearchObservations(
  flags: ResearchFlag[], sources: ReadonlyMap<string, { hostname: string; createdAt: Date }>, observedBy: Date,
) {
  const counts = new Map<string, { flags: Set<string>; sites: Set<string>; audits: Set<string> }>()
  for (const flag of flags) {
    const audit = sources.get(flag.auditId)
    const checkId = baseCheckId(flag.checkId)
    if (flag.source !== 'DETERMINISTIC' || !Number.isFinite(flag.confidence) || flag.confidence < 0.8 || flag.confidence > 1 ||
      !audit || flag.createdAt < audit.createdAt || flag.createdAt > observedBy || !checkId ||
      !isPermittedPublicResearchCheck(checkId)) continue
    const count = counts.get(checkId) ?? { flags: new Set<string>(), sites: new Set<string>(), audits: new Set<string>() }
    count.flags.add(flag.id)
    count.sites.add(audit.hostname)
    count.audits.add(flag.auditId)
    counts.set(checkId, count)
  }
  return counts
}
