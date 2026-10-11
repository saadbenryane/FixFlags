import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { includeLegacySiteAnalyses } from './analysis-scope'

export async function loadLegacySiteAnalysisIds(projectIds: string[]) {
  if (!projectIds.length) return []
  const sites = await prisma.provisionalSite.findMany({
    where: { claimedProjectId: { in: projectIds }, primaryAuditId: { not: null } }, select: { primaryAuditId: true },
  })
  return sites.flatMap(site => site.primaryAuditId ? [site.primaryAuditId] : [])
}

export async function loadSiteAnalysisSelection(site: SiteRecord) {
  const legacyIds = site.kind === 'provisional' && site.primaryAuditId ? [site.primaryAuditId]
    : await loadLegacySiteAnalysisIds(site.projectId ? [site.projectId] : [])
  return { legacyIds, where: includeLegacySiteAnalyses(legacyIds) }
}
