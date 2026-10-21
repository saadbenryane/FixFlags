import { repairGuidanceState, repairGuidanceText, type RepairGuidanceState } from '@/lib/improvements/repair-guidance'
import { flagEvidenceContext, type FlagEvidenceContext } from './flag-evidence'
import { publicSupportingObservations, readSupportingObservations } from '@/lib/audit/flag-observations'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { customerExpectedBehavior } from '@/lib/sites/flag-label'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { selectResolvedFlags, newestRecordedFlag, siteFlagDetailStatus, currentIncidentFlags, currentImprovementFlags, incidentAffectedPaths, hasIncidentRecoveryProof, currentUnboundFindings } from '@/lib/sites/flag-resolution'
import { currentImprovementWhere, loadIncidentRecoveryProofs, unboundSiteFindingWhere } from './application/incident-proofs'
import { compareFlagPriority, flagPriority, type FlagVerificationState } from '@/lib/sites/presentation'
import type { SiteRecord } from '@/lib/sites/types'
import { attemptHasActiveVerification, attemptProvesFlagRecovery } from '@/lib/improvements/attempt-state'
import type { Prisma } from '@prisma/client'
import type { AgentPrompts } from '@/lib/audit/flag-types'

const guidanceSelect = { fix: true, agentPrompt: true, cursorPrompt: true, claudePrompt: true,
  windsurfPrompt: true, lovablePrompt: true, boltPrompt: true } satisfies Prisma.FlagSelect

const attemptVerificationSelect = { id: true, projectId: true, parentId: true, status: true, verifierExecutions: {
  where: { workKind: 'finalize', workState: { in: ['READY', 'RUNNING', 'RETRY_WAIT'] } }, take: 1,
  select: { workKind: true, workState: true },
} } satisfies Prisma.AuditSelect

function toSiteFlagSeed(flag: Partial<AgentPrompts> & {
  attentionPolicy?: unknown
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
    attentionPolicy: flag.attentionPolicy,
    id: flag.improvementId ?? flag.id,
    sourceFlagId: flag.sourceFlagId ?? flag.id,
    confidence: flag.confidence ?? null,
    improvementId: flag.improvementId ?? null,
    checkId: flag.checkId,
    rubric: flag.rubric,
    severity: flag.severity,
    impactTag: flag.impactTag,
    problem: searchAttentionDecision(flag)?.reason === 'historical_intent_not_established' ? SEARCH_COPY.historicalPolicy : flag.problem,
    evidence: flag.evidence,
    whyItMatters: flag.whyItMatters,
    fix: repairGuidanceText(flag),
    pageUrl: flag.pageUrl,
    status: flag.status,
    resolvedInId: flag.resolvedInId,
    area: cardAreaForCheck(flag),
    affectedPaths,
    affectedPageCount: affectedPaths.length,
    priorityBand: priority.band,
    priorityScore: priority.score,
    relatedOutcome: flag.relatedOutcome ?? null,
    verificationState: flag.verificationState ?? verificationState(flag.status ?? 'OPEN', false),
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
    else if (searchAttentionDecision(seed)?.kind !== 'observation') recommendations.push(seed)
  }
  return { flags, recommendations }
}

async function loadAllOpenSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind === 'project' && site.projectId) {
    const improvements = await prisma.improvement.findMany({
      where: {
        projectId: site.projectId,
        ...currentImprovementWhere,
      },
      orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
      include: {
        outcome: { select: { id: true, name: true } },
        occurrences: { orderBy: { createdAt: 'desc' }, include: { flag: true } },
        attempts: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12,
          select: { outcome: true, comparable: true, sourceAuditId: true, handoffReference: true, verificationAuditId: true,
            verificationAudit: { select: attemptVerificationSelect } } },
      },
    })

    // Claimed observations and interrupted materialization can precede their
    // Improvement occurrence. A later partial check cannot erase those findings.
    const unbound = await prisma.flag.findMany({
      where: unboundSiteFindingWhere(site.projectId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })
    const unboundProofs = (await loadIncidentRecoveryProofs([{ projectId: site.projectId, flags: unbound }])).get(site.projectId) ?? new Set<string>()
    const auditFlags = currentUnboundFindings(unbound, unboundProofs)

    if (improvements.length > 0) {
      const proofIds = (await loadIncidentRecoveryProofs([{ projectId: site.projectId,
        flags: improvements.flatMap(imp => (imp.occurrences ?? []).map(occurrence => occurrence.flag)) }])).get(site.projectId) ?? new Set<string>()
      const projected = improvements.flatMap((imp) => {
        if (!imp.occurrences?.length) return []
        const currentOccurrenceFlags = currentImprovementFlags((imp.occurrences ?? []).map(occurrence => occurrence.flag), proofIds,
          imp.status, imp.attempts ?? [], site.projectId!)
        const auditFlag = currentImprovementFlags(auditFlags.filter(candidate => candidate.fingerprint === imp.fingerprint), proofIds,
          imp.status, imp.attempts ?? [], site.projectId!)[0]
        if (imp.occurrences?.length > 0 && currentOccurrenceFlags.length === 0 && !auditFlag) return []
        const flag = newestRecordedFlag([...currentOccurrenceFlags, ...(auditFlag ? [auditFlag] : [])]) ?? imp.occurrences?.[0]?.flag
        if (!flag) return []
        const paths = incidentAffectedPaths(currentOccurrenceFlags)
        if (auditFlag?.pageUrl) paths.push(auditFlag.pageUrl)
        return [toSiteFlagSeed({
          ...flag,
          status: flag?.status === 'UNVERIFIED' ? 'UNVERIFIED' : siteFlagDetailStatus(imp.status, flag?.status ?? 'OPEN'),
          improvementId: imp.id,
          affectedPaths: paths,
          relatedOutcome: imp.outcome ?? null,
          verificationState: verificationState(flag?.status === 'UNVERIFIED' ? 'UNVERIFIED' : siteFlagDetailStatus(imp.status, flag?.status ?? 'OPEN'),
            attemptHasActiveVerification(imp.attempts?.[0], site.projectId!, flag?.auditId)),
          latestOccurrenceAt: imp.occurrences?.find(occurrence => occurrence.flag.id === flag.id)?.createdAt ?? flag.createdAt ?? null,
        })]
      })
      const representedFingerprints = new Set(improvements.filter(improvement => improvement.occurrences?.length)
        .map(improvement => improvement.fingerprint))
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
      attentionPolicy: true,
      id: true,
      auditId: true,
      checkId: true,
      fingerprint: true,
      rubric: true,
      severity: true,
      impactTag: true,
      problem: true,
      evidence: true,
      whyItMatters: true,
      ...guidanceSelect,
      pageUrl: true,
      status: true,
      resolvedInId: true,
      createdAt: true,
      confidence: true,
      improvementOccurrence: { select: { improvementId: true } },
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
        take: 12,
        select: { createdAt: true, outcome: true, comparable: true, sourceAuditId: true, handoffReference: true,
          verificationAuditId: true, verificationAudit: { select: attemptVerificationSelect } },
      },
      occurrences: {
        orderBy: { createdAt: 'desc' },
        include: {
          flag: {
            select: {
              attentionPolicy: true,
              id: true,
              auditId: true,
              status: true,
              checkId: true,
              rubric: true,
              severity: true,
              impactTag: true,
              problem: true,
              evidence: true,
              whyItMatters: true,
              ...guidanceSelect,
              pageUrl: true,
              confidence: true,
            },
          },
        },
      },
    },
  })

  const recoveries = (await loadIncidentRecoveryProofs([{ projectId: site.projectId, flags: rows }])).get(site.projectId)
  const fixedEntries = rows.flatMap(flag => {
    const at = recoveries && hasIncidentRecoveryProof(flag, recoveries) && flag.resolvedInId ? recoveries.get(flag.resolvedInId) : null
    return at ? [{ at: at.toISOString(), seed: toSiteFlagSeed({ ...flag,
      improvementId: flag.improvementOccurrence?.improvementId ?? null,
      verificationState: 'verified', latestOccurrenceAt: at,
    }) }] : []
  })
  const verifiedEntries = verified.flatMap((improvement) => {
    const matching = improvement.attempts.map(attempt => ({ attempt, matched: improvement.occurrences.filter(occurrence => occurrence.flag &&
      occurrence.flag.status === 'OPEN' && attemptProvesFlagRecovery(attempt, site.projectId!, occurrence.flag.auditId, occurrence.flag.id)) }))
      .find(value => value.matched.length > 0)
    const attempt = matching?.attempt, matched = matching?.matched ?? []
    const display = matched[0]?.flag
    if (!attempt?.verificationAuditId || !display) return []
    return [{
      at: attempt.createdAt.toISOString(),
      occurrenceFlagIds: matched.map((occurrence) => occurrence.flagId),
      seed: toSiteFlagSeed({
        ...display,
        status: 'VERIFIED',
        resolvedInId: null,
        improvementId: improvement.id,
        affectedPaths: matched.map((occurrence) => occurrence.flag?.pageUrl).filter((path): path is string => Boolean(path)),
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
  sourceAuditId?: string
  handoffReference?: string | null
  commitReference?: string | null
  deploymentReference?: string | null
  verificationAuditId: string | null
  verifying?: boolean
}

export type SiteFlagDetail = SiteFlagSeed & {
  repairGuidance?: RepairGuidanceState
  supportingObservations?: ReturnType<typeof publicSupportingObservations>
  supportingEvidenceUnreadable?: boolean
  outcomeId: string | null
  sourceAuditId: string
  evidenceContext?: FlagEvidenceContext
  performanceEvidence?: import('@/lib/audit/performance-measurement').PerformanceMeasurement[]
  performanceEvidenceSource?: 'lab' | 'field' | null
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
  if (Array.isArray(targets)) {
    const devices = [...new Set(targets.flatMap(value => value && typeof value === 'object' && ['desktop', 'mobile'].includes(value.device) ? [value.device as string] : []))]
    return devices.length ? devices.join(', ') : null
  }
  const value = targets as { viewport?: string; device?: string }
  return value.viewport ?? value.device ?? null
}

export async function loadSiteFlagDetail(
  site: SiteRecord,
  flagId: string
): Promise<SiteFlagDetail | null> {
  // Detail is a historical resource, independent of the open inbox and its pagination.
  let flagRow = await prisma.flag.findFirst({
    where: {
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' },
      OR: [{ id: flagId }, { improvementOccurrence: { improvementId: flagId } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { improvementOccurrence: { include: { improvement: true } },
      audit: { select: { includeAi: true, triageAt: true, aiReviewAt: true, failureCode: true } } },
  })
  if (!flagRow) return null
  const incidentId = flagRow.improvementOccurrence?.improvement.id
  const occurrenceScope = incidentId ? await prisma.improvementOccurrence.findMany({
    where: { improvementId: incidentId, audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, flag: { select: { id: true, auditId: true, pageUrl: true, affectedPaths: true, status: true, resolvedInId: true,
      checkId: true, fingerprint: true, verificationRule: true, evidenceTargets: true, attentionPolicy: true, supportingObservations: true } } },
  }) : []
  const recoveries = site.projectId ? (await loadIncidentRecoveryProofs([{ projectId: site.projectId,
    flags: [flagRow, ...occurrenceScope.map(occurrence => occurrence.flag)] }])).get(site.projectId) : null
  const activeScope = currentIncidentFlags(occurrenceScope.map(occurrence => occurrence.flag), recoveries ?? new Set<string>())
  // Durable incident links open the unresolved original capture. Exact Flag
  // links remain historical resources, including completed recoveries.
  if (flagRow.id !== flagId && activeScope[0] && activeScope[0].id !== flagRow.id) {
    flagRow = await prisma.flag.findFirst({ where: { id: activeScope[0].id,
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } },
      include: { improvementOccurrence: { include: { improvement: true } },
      audit: { select: { includeAi: true, triageAt: true, aiReviewAt: true, failureCode: true } } } })
    if (!flagRow) return null
  }
  const improvement = flagRow.improvementOccurrence?.improvement
  const provenRecovery = flagRow.status === 'FIXED' && recoveries && hasIncidentRecoveryProof(flagRow, recoveries)
  const seed = toSiteFlagSeed({
    ...flagRow,
    improvementId: improvement?.id,
    status: flagRow.status === 'FIXED' && !provenRecovery ? 'UNVERIFIED' : siteFlagDetailStatus(improvement?.status, flagRow.status),
    resolvedInId: flagRow.resolvedInId ?? null,
  })

  const improvementId = seed.improvementId
  const attempts = improvementId
    ? await prisma.improvementAttempt.findMany({
        where: { improvementId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: {
          id: true,
          createdAt: true,
          builder: true,
          outcome: true,
          comparable: true,
          verificationReason: true,
          changeSummary: true,
          commitReference: true,
          deploymentReference: true,
          verificationAuditId: true,
          sourceAuditId: true,
          handoffReference: true,
          verificationAudit: { select: attemptVerificationSelect },
        },
      })
    : []

  const linkedOutcome = improvement?.outcomeId && site.projectId
    ? await prisma.siteOutcome.findFirst({
        where: { id: improvement.outcomeId, projectId: site.projectId },
        select: { id: true, name: true, expectation: true },
      }) : null
  const expectedBehavior = linkedOutcome?.expectation?.trim() || customerExpectedBehavior(seed.checkId, flagRow?.verificationRule)

  const affectedPaths = flagRow.id === flagId ? seed.affectedPaths : incidentAffectedPaths(activeScope)
  const sourceStatus = flagRow.status === 'FIXED' && !provenRecovery ? 'UNVERIFIED'
    : siteFlagDetailStatus(improvement?.status, flagRow.status, Boolean(site.projectId && attempts.some(attempt =>
      attemptProvesFlagRecovery(attempt, site.projectId!, flagRow.auditId, flagRow.id))))
  const scopedSeed = toSiteFlagSeed({
    ...seed,
    status: sourceStatus,
    affectedPaths: affectedPaths.length > 0 ? affectedPaths : seed.affectedPaths,
    latestOccurrenceAt: occurrenceScope[0]?.createdAt ?? seed.latestOccurrenceAt,
    verificationState: verificationState(sourceStatus, attemptHasActiveVerification(attempts[0], site.projectId!, flagRow.auditId)),
  })

  return {
    ...scopedSeed,
    relatedOutcome: linkedOutcome ? { id: linkedOutcome.id, name: linkedOutcome.name } : scopedSeed.relatedOutcome,
    outcomeId: improvement?.outcomeId ?? null,
    sourceAuditId: flagRow.auditId,
    repairGuidance: repairGuidanceState(flagRow),
    evidenceContext: flagEvidenceContext(flagRow),
    supportingObservations: publicSupportingObservations(flagRow.supportingObservations),
    supportingEvidenceUnreadable: flagRow.supportingObservations != null && !readSupportingObservations(flagRow.supportingObservations),
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
      sourceAuditId: attempt.sourceAuditId,
      handoffReference: attempt.handoffReference,
      commitReference: attempt.commitReference ?? null,
      deploymentReference: attempt.deploymentReference ?? null,
      verificationAuditId: attempt.verificationAuditId,
      verifying: attemptHasActiveVerification(attempt, site.projectId!),
    })),
    verifying: attemptHasActiveVerification(attempts[0], site.projectId!, flagRow.auditId),
  }
}
