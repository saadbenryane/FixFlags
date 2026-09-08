import { prisma } from '@/lib/db'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'

export async function loadSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind === 'project' && site.projectId) {
    const improvements = await prisma.improvement.findMany({
      where: {
        projectId: site.projectId,
        status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS'] },
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      take: 50,
    })

    const latestAudit = await prisma.audit.findFirst({
      where: { projectId: site.projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    const auditFlags = latestAudit
      ? await prisma.flag.findMany({
          where: { auditId: latestAudit.id, status: 'OPEN' },
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
          take: 50,
        })
      : []

    if (improvements.length > 0) {
      return improvements.map((imp) => {
        const flag = auditFlags.find((f) => f.fingerprint === imp.fingerprint)
        return {
          id: flag?.id ?? imp.id,
          improvementId: imp.id,
          checkId: flag?.checkId ?? null,
          rubric: flag?.rubric ?? 'EXPERIENCE',
          severity: flag?.severity ?? 'IMPORTANT',
          impactTag: flag?.impactTag ?? null,
          problem: imp.title || flag?.problem || 'Needs attention',
          evidence: flag?.evidence ?? imp.expectedBenefit,
          whyItMatters: flag?.whyItMatters ?? imp.expectedBenefit,
          fix: flag?.fix ?? imp.recommendedChange,
          pageUrl: flag?.pageUrl ?? null,
          status: imp.status,
          area: cardAreaForCheck({
            checkId: flag?.checkId,
            rubric: flag?.rubric,
            impactTag: flag?.impactTag,
          }),
        }
      })
    }

    return auditFlags.map((flag) => ({
      id: flag.id,
      improvementId: null,
      checkId: flag.checkId,
      rubric: flag.rubric,
      severity: flag.severity,
      impactTag: flag.impactTag,
      problem: flag.problem,
      evidence: flag.evidence,
      whyItMatters: flag.whyItMatters,
      fix: flag.fix,
      pageUrl: flag.pageUrl,
      status: flag.status,
      area: cardAreaForCheck(flag),
    }))
  }

  const auditId = site.primaryAuditId
  if (!auditId) return []

  const flags = await prisma.flag.findMany({
    where: { auditId, status: 'OPEN' },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: 50,
  })

  return flags.map((flag) => ({
    id: flag.id,
    improvementId: null,
    checkId: flag.checkId,
    rubric: flag.rubric,
    severity: flag.severity,
    impactTag: flag.impactTag,
    problem: flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters,
    fix: flag.fix,
    pageUrl: flag.pageUrl,
    status: flag.status,
    area: cardAreaForCheck(flag),
  }))
}

export async function loadSiteFlagDetail(
  site: SiteRecord,
  flagId: string
): Promise<SiteFlagSeed | null> {
  const flags = await loadSiteFlags(site)
  return flags.find((f) => f.id === flagId || f.improvementId === flagId) ?? null
}
