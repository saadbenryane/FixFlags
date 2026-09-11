import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import type { SiteRecord } from '@/lib/sites/types'

function toSiteFlagSeed(flag: {
  id: string
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  pageUrl: string | null
  status: string
  improvementId?: string | null
  confidence?: number | null
}): SiteFlagSeed {
  return {
    id: flag.improvementId ?? flag.id,
    sourceFlagId: flag.id,
    confidence: flag.confidence ?? null,
    improvementId: flag.improvementId ?? null,
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
  }
}

function partitionCustomerFlags(seeds: SiteFlagSeed[]): {
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
} {
  const flags: SiteFlagSeed[] = []
  const recommendations: SiteFlagSeed[] = []
  for (const seed of seeds) {
    if (isCustomerFlag(seed)) flags.push(seed)
    else recommendations.push(seed)
  }
  return { flags, recommendations }
}

async function loadAllOpenSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind === 'project' && site.projectId) {
    const improvements = await prisma.improvement.findMany({
      where: {
        projectId: site.projectId,
        status: { in: ['PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'READY_TO_VERIFY', 'UNVERIFIED'] },
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      include: { occurrences: { orderBy: { createdAt: 'desc' }, take: 1, include: { flag: true } } },
    })

    const latestAudit = await prisma.audit.findFirst({
      where: { projectId: site.projectId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    const auditFlags = latestAudit
      ? await prisma.flag.findMany({
          where: { auditId: latestAudit.id, status: { in: ['OPEN', 'REGRESSED'] } },
          orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
            })
      : []

    if (improvements.length > 0) {
      const projected = improvements.map((imp) => {
        const flag = auditFlags.find((f) => f.fingerprint === imp.fingerprint) ?? imp.occurrences?.[0]?.flag
        return {
          id: imp.id,
          sourceFlagId: flag?.id ?? null,
          confidence: flag?.confidence ?? null,
          improvementId: imp.id,
          checkId: flag?.checkId ?? null,
          rubric: flag?.rubric ?? 'EXPERIENCE',
          severity: flag?.severity ?? 'IMPORTANT',
          impactTag: flag?.impactTag ?? null,
          problem: imp.title || flag?.problem || 'Open Flag',
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
      const represented = new Set(projected.map((flag) => flag.sourceFlagId))
      return [...projected, ...auditFlags.filter((flag) => !represented.has(flag.id)).map(toSiteFlagSeed)]
    }

    return auditFlags.map((flag) => ({
      id: flag.id,
      sourceFlagId: flag.id,
      confidence: flag.confidence,
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
    where: { auditId, status: { in: ['OPEN', 'REGRESSED'] } },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  return flags.map((flag) => toSiteFlagSeed(flag))
}

export async function loadSiteFindings(site: SiteRecord): Promise<{
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
}> {
  return partitionCustomerFlags(await loadAllOpenSiteFlags(site))
}

export async function loadSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).flags
}

export async function loadSiteRecommendations(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).recommendations
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
  sourceAuditId: string
  verificationRule: string | null
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
  // Detail is a historical resource, independent of the open inbox and its pagination.
  const flagRow = await prisma.flag.findFirst({
    where: {
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' },
      OR: [{ id: flagId }, { improvementOccurrence: { improvementId: flagId } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { improvementOccurrence: { include: { improvement: true } } },
  })
  if (!flagRow) return null
  const improvement = flagRow.improvementOccurrence?.improvement
  const seed = toSiteFlagSeed({
    ...flagRow,
    improvementId: improvement?.id,
    status: improvement?.status ?? flagRow.status,
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
    'Recovery criteria have not been established.'

  return {
    ...seed,
    sourceAuditId: flagRow.auditId,
    verificationRule: flagRow.verificationRule,
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
