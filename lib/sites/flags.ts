import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { customerExpectedBehavior } from '@/lib/sites/flag-label'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { selectResolvedFlags, siteFlagDetailStatus } from '@/lib/sites/flag-resolution'
import { compareFlagPriority, flagPriority, type FlagVerificationState } from '@/lib/sites/presentation'
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
  resolvedInId: string | null
  improvementId?: string | null
  sourceFlagId?: string | null
  confidence?: number | null
  affectedPaths?: unknown
  relatedOutcome?: { id: string; name: string } | null
  verificationState?: FlagVerificationState
  latestOccurrenceAt?: string | Date | null
}): SiteFlagSeed {
  const storedPaths = Array.isArray(flag.affectedPaths)
    ? flag.affectedPaths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []
  const affectedPaths = [...new Set((storedPaths.length > 0 ? storedPaths : [flag.pageUrl]).filter((path): path is string => Boolean(path)))]
  const priority = flagPriority({
    severity: flag.severity,
    confidence: flag.confidence,
    affectedPageCount: affectedPaths.length,
    outcomeId: flag.relatedOutcome?.id,
  })
  return {
    id: flag.improvementId ?? flag.id,
    sourceFlagId: flag.sourceFlagId ?? flag.id,
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
    resolvedInId: flag.resolvedInId,
    area: cardAreaForCheck(flag),
    affectedPaths,
    affectedPageCount: affectedPaths.length,
    priorityBand: priority.band,
    priorityScore: priority.score,
    relatedOutcome: flag.relatedOutcome ?? null,
    verificationState: flag.verificationState ?? (flag.status === 'REGRESSED' ? 'regressed' : 'unverified'),
    latestOccurrenceAt: flag.latestOccurrenceAt instanceof Date
      ? flag.latestOccurrenceAt.toISOString()
      : flag.latestOccurrenceAt ?? null,
  }
}

function verificationState(status: string, verifying: boolean): FlagVerificationState {
  if (verifying) return 'verifying'
  if (status === 'VERIFIED' || status === 'FIXED') return 'verified'
  if (status === 'UNVERIFIED') return 'could_not_verify'
  if (status === 'REGRESSED') return 'regressed'
  if (status === 'READY_TO_VERIFY') return 'unverified'
  return 'still_open'
}

/** A missing action already explains the page. Do not also say that action was slow. */
export function withoutSlowCtaBesideMissingAction<T extends { checkId: string | null; pageUrl: string | null }>(
  flags: T[],
): T[] {
  const pagesMissingAction = new Set(
    flags
      .filter((flag) => Boolean(flag.checkId?.endsWith('hidden-cta') || flag.checkId?.includes('no-cta-found')))
      .map((flag) => flag.pageUrl ?? ''),
  )
  if (pagesMissingAction.size === 0) return flags
  return flags.filter((flag) => {
    if (flag.checkId !== 'slow-3g-cta-delayed') return true
    return !pagesMissingAction.has(flag.pageUrl ?? '')
  })
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
      include: {
        outcome: { select: { id: true, name: true } },
        occurrences: { orderBy: { createdAt: 'desc' }, include: { flag: true } },
        attempts: { orderBy: { createdAt: 'desc' }, take: 1, select: { outcome: true } },
      },
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
        const currentOccurrenceFlags = (imp.occurrences ?? [])
          .map((occurrence) => occurrence.flag)
          .filter((flag) => flag.status === 'OPEN' || flag.status === 'REGRESSED')
        const auditFlag = auditFlags.find((candidate) => candidate.fingerprint === imp.fingerprint)
        const flag = auditFlag ?? currentOccurrenceFlags[0] ?? imp.occurrences?.[0]?.flag
        const paths = currentOccurrenceFlags.map((candidate) => candidate.pageUrl).filter((path): path is string => Boolean(path))
        if (auditFlag?.pageUrl) paths.push(auditFlag.pageUrl)
        return toSiteFlagSeed({
          ...(flag ?? {
            id: imp.id,
            checkId: null,
            rubric: 'EXPERIENCE',
            severity: 'IMPORTANT',
            impactTag: null,
            problem: imp.title || 'Open Flag',
            evidence: imp.expectedBenefit,
            whyItMatters: imp.expectedBenefit,
            fix: imp.recommendedChange,
            pageUrl: null,
            resolvedInId: null,
          }),
          status: imp.status,
          improvementId: imp.id,
          affectedPaths: paths,
          relatedOutcome: imp.outcome ?? null,
          verificationState: verificationState(imp.status, imp.attempts?.[0]?.outcome == null && Boolean(imp.attempts?.length)),
          latestOccurrenceAt: imp.occurrences?.[0]?.createdAt ?? null,
        })
      })
      const representedFingerprints = new Set(improvements.map((improvement) => improvement.fingerprint))
      return [
        ...projected,
        ...auditFlags.filter((flag) => !flag.fingerprint || !representedFingerprints.has(flag.fingerprint)).map(toSiteFlagSeed),
      ].sort(compareFlagPriority)
    }

    return auditFlags.map((flag) => toSiteFlagSeed(flag)).sort(compareFlagPriority)
  }

  const auditId = site.primaryAuditId
  if (!auditId) return []

  const flags = await prisma.flag.findMany({
    where: { auditId, status: { in: ['OPEN', 'REGRESSED'] } },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
  })

  return flags.map((flag) => toSiteFlagSeed(flag)).sort(compareFlagPriority)
}

export async function loadSiteFindings(site: SiteRecord): Promise<{
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
}> {
  return partitionCustomerFlags(withoutSlowCtaBesideMissingAction(await loadAllOpenSiteFlags(site)))
}

export async function loadSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).flags
}

export async function loadSiteRecommendations(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).recommendations
}

export async function loadSiteResolvedFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind !== 'project' || !site.projectId) return []
  const rows = await prisma.flag.findMany({
    where: {
      audit: { projectId: site.projectId },
      status: 'FIXED',
      resolvedInId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      checkId: true,
      rubric: true,
      severity: true,
      impactTag: true,
      problem: true,
      evidence: true,
      whyItMatters: true,
      fix: true,
      pageUrl: true,
      status: true,
      resolvedInId: true,
      createdAt: true,
      confidence: true,
    },
  })
  const verified = await prisma.improvement.findMany({
    where: {
      projectId: site.projectId,
      status: 'VERIFIED',
      attempts: {
        some: {
          outcome: 'IMPROVED',
          comparable: true,
          verificationAuditId: { not: null },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    include: {
      attempts: {
        where: {
          outcome: 'IMPROVED',
          comparable: true,
          verificationAuditId: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, verificationAuditId: true },
      },
      occurrences: {
        orderBy: { createdAt: 'desc' },
        include: {
          flag: {
            select: {
              id: true,
              checkId: true,
              rubric: true,
              severity: true,
              impactTag: true,
              problem: true,
              evidence: true,
              whyItMatters: true,
              fix: true,
              pageUrl: true,
              confidence: true,
            },
          },
        },
      },
    },
  })

  const fixedEntries = rows.map((flag) => ({
    at: flag.createdAt.toISOString(),
    seed: toSiteFlagSeed({ ...flag, improvementId: null }),
  }))
  const verifiedEntries = verified.flatMap((improvement) => {
    const attempt = improvement.attempts[0]
    const display = improvement.occurrences.find((occurrence) => occurrence.flag)?.flag
    if (!attempt?.verificationAuditId || !display) return []
    return [{
      at: attempt.createdAt.toISOString(),
      occurrenceFlagIds: improvement.occurrences.map((occurrence) => occurrence.flagId),
      seed: toSiteFlagSeed({
        ...display,
        status: 'VERIFIED',
        resolvedInId: null,
        improvementId: improvement.id,
        affectedPaths: improvement.occurrences.map((occurrence) => occurrence.flag?.pageUrl).filter((path): path is string => Boolean(path)),
        verificationState: 'verified',
        latestOccurrenceAt: attempt.createdAt,
      }),
    }]
  })
  return selectResolvedFlags([...fixedEntries, ...verifiedEntries])
}

export type SiteFlagAttemptView = {
  id: string
  createdAt: string
  builder: string
  outcome: string | null
  comparable: boolean | null
  reason: string | null
  changeSummary: string | null
  verificationAuditId: string | null
}

export type SiteFlagDetail = SiteFlagSeed & {
  outcomeId: string | null
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
    status: siteFlagDetailStatus(improvement?.status, flagRow.status),
    resolvedInId: flagRow.resolvedInId ?? null,
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
          verificationAuditId: true,
        },
      })
    : []

  const linkedOutcome = improvement?.outcomeId && site.projectId
    ? await prisma.siteOutcome.findFirst({
        where: { id: improvement.outcomeId, projectId: site.projectId },
        select: { id: true, name: true, expectation: true },
      }) : null
  const expectedBehavior = linkedOutcome?.expectation?.trim() || customerExpectedBehavior(seed.checkId, flagRow?.verificationRule)

  const occurrenceScope = improvementId
    ? await prisma.improvementOccurrence.findMany({
        where: { improvementId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true, flag: { select: { pageUrl: true, status: true } } },
      })
    : []
  const affectedPaths = [...new Set(occurrenceScope
    .filter((occurrence) => occurrence.flag.status === 'OPEN' || occurrence.flag.status === 'REGRESSED')
    .map((occurrence) => occurrence.flag.pageUrl)
    .filter((path): path is string => Boolean(path)))]
  const scopedSeed = toSiteFlagSeed({
    ...seed,
    affectedPaths: affectedPaths.length > 0 ? affectedPaths : seed.affectedPaths,
    latestOccurrenceAt: occurrenceScope[0]?.createdAt ?? seed.latestOccurrenceAt,
    verificationState: verificationState(seed.status, attempts.some((attempt) => attempt.outcome == null)),
  })

  return {
    ...scopedSeed,
    relatedOutcome: linkedOutcome ? { id: linkedOutcome.id, name: linkedOutcome.name } : scopedSeed.relatedOutcome,
    outcomeId: improvement?.outcomeId ?? null,
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
      verificationAuditId: attempt.verificationAuditId,
    })),
    verifying: attempts.some((attempt) => attempt.outcome == null),
  }
}
