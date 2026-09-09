import { prisma } from '@/lib/db'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'

export async function loadSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind === 'project' && site.projectId) {
    const improvements = await prisma.improvement.findMany({
      where: {
        projectId: site.projectId,
        status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED'] },
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      include: { occurrences: { orderBy: { createdAt: 'desc' }, take: 1, include: { flag: true } } },
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
        const flag = auditFlags.find((f) => f.fingerprint === imp.fingerprint) ?? imp.occurrences?.[0]?.flag
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
            rubric: flag?.rubric ?? 'EXPERIENCE',
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

export type SiteFlagAttemptView = {
  id: string
  createdAt: string
  builder: string
  outcome: string | null
  comparable: boolean | null
  reason: string | null
  changeSummary: string | null
}

export type SiteFlagDetail = SiteFlagSeed & {
  confidence: number | null
  causeCertainty: string | null
  expectedBehavior: string
  evidenceMissing: boolean
  viewport: string | null
  attempts: SiteFlagAttemptView[]
  verifying: boolean
}

function viewportFromEvidence(targets: unknown): string | null {
  if (!targets || typeof targets !== 'object') return null
  const value = targets as { viewport?: string; device?: string }
  return value.viewport ?? value.device ?? null
}

export async function loadSiteFlagDetail(
  site: SiteRecord,
  flagId: string
): Promise<SiteFlagDetail | null> {
  const flags = await loadSiteFlags(site)
  const seed = flags.find((f) => f.id === flagId || f.improvementId === flagId)
  if (!seed) return null

  const flagRow = await prisma.flag.findUnique({
    where: { id: seed.id },
    select: {
      confidence: true,
      causeCertainty: true,
      verificationRule: true,
      evidence: true,
      evidenceTargets: true,
      problem: true,
    },
  })

  const improvementId = seed.improvementId
  const attempts = improvementId
    ? await prisma.improvementAttempt.findMany({
        where: { improvementId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          id: true,
          createdAt: true,
          builder: true,
          outcome: true,
          comparable: true,
          verificationReason: true,
          changeSummary: true,
        },
      })
    : []

  const expectedBehavior =
    flagRow?.verificationRule?.trim() ||
    `A fresh check of the same page and action no longer observes: ${seed.problem}`

  return {
    ...seed,
    confidence: flagRow?.confidence ?? null,
    causeCertainty: flagRow?.causeCertainty ?? null,
    expectedBehavior,
    evidenceMissing: !(flagRow?.evidence ?? seed.evidence)?.trim(),
    viewport: viewportFromEvidence(flagRow?.evidenceTargets),
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      createdAt: attempt.createdAt.toISOString(),
      builder: attempt.builder,
      outcome: attempt.outcome,
      comparable: attempt.comparable,
      reason: attempt.verificationReason,
      changeSummary: attempt.changeSummary,
    })),
    verifying: attempts.some((attempt) => attempt.outcome == null),
  }
}
