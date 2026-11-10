import { repairGuidanceState, resolveRepairDefinition, type RepairDefinition, type RepairGuidanceState } from '@/lib/improvements/repair-guidance'
import { flagEvidenceContext, type FlagEvidenceContext } from './flag-evidence'
import { publicSupportingObservations, hasUnreadableStoredSupportingObservations } from '@/lib/audit/flag-observations'
import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'
import { searchAttentionDecision } from '@/lib/audit/search/policy'
import { SEARCH_COPY } from '@/lib/marketing/copy/search'
import { cardAreaForCheck } from '@/lib/sites/card-areas'
import { customerExpectedBehavior } from '@/lib/sites/flag-label'
import type { SiteFlagSeed } from '@/lib/sites/coverage'
import { selectResolvedFlags, newestRecordedFlag, siteFlagDetailStatus, currentIncidentFlags, incidentAffectedPaths, hasIncidentRecoveryProof } from '@/lib/sites/flag-resolution'
import { currentImprovementWhere, loadIncidentRecoveryProofs } from './application/incident-proofs'
import { compareFlagPriority, flagPriority, type FlagVerificationState } from '@/lib/sites/presentation'
import type { SiteRecord } from '@/lib/sites/types'
import { attemptHasActiveVerification } from '@/lib/improvements/attempt-state'
import type { Prisma } from '@prisma/client'
import type { AgentPrompts } from '@/lib/audit/flag-types'
import { incidentSupportingEvidence } from './incident-supporting-evidence'
import { customerFindingExplanation } from './finding-label'
import { readSiteEvidence } from './application/site-evidence-read'
import { createHash } from 'node:crypto'
import { loadCurrentFlagVerifications } from './application/flag-verification-state'
import { loadCurrentFindingSources } from './application/current-finding-sources'
import { latestConfirmedOutcomeFlagId } from './application/outcome-finding-sources'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { SiteRunRefusal } from './application/run-refusal'
import { loadResolvedFindingSources, resolvedSourceMatches } from './application/resolved-finding-sources'
import { loadAcceptedFlagRecoveries } from './application/accepted-flag-recoveries'
import { readSupportingEvidencePage, supportingEvidenceRevision, type SupportingEvidencePage } from './supporting-evidence'
import { buildSiteRepairBrief } from './repair-brief'
import { combineAccessibilityFixes } from '@/lib/audit/flag-identity'

const guidanceSelect = { fix: true, agentPrompt: true, cursorPrompt: true, claudePrompt: true,
  windsurfPrompt: true, lovablePrompt: true, boltPrompt: true } satisfies Prisma.FlagSelect
const guidanceAuditSelect = { includeAi: true, triageAt: true, aiReviewAt: true, failureCode: true } satisfies Prisma.AuditSelect
const guidanceInclude = { audit: { select: guidanceAuditSelect } } satisfies Prisma.FlagInclude

// Historical occurrences establish current scope and recovery. Editor tasks
// belong only to the representatives selected for the current overview.
const findingSelect = { id: true, auditId: true, createdAt: true, source: true, checkId: true, rubric: true, severity: true,
  impactTag: true, problem: true, evidence: true, whyItMatters: true, fix: true, pageUrl: true, status: true,
  resolvedInId: true, confidence: true, affectedPaths: true, fingerprint: true, verificationRule: true,
  supportingObservations: true, supportingObservationVersion: true, supportingObservationIndex: true,
  evidenceTargets: true, attentionPolicy: true,
  improvementOccurrence: { select: { improvementId: true } } } satisfies Prisma.FlagSelect

async function loadFindingEvidence(projectId: string, sourceIds: string[], includeSupporting = true) {
  const ids = [...new Set(sourceIds)]
  const evidence = new Map<string, Prisma.FlagGetPayload<{ select: typeof findingSelect }>>()
  for (let offset = 0; offset < ids.length; offset += 128) {
    for (const flag of await prisma.flag.findMany({ where: { id: { in: ids.slice(offset, offset + 128) }, audit: { projectId } },
      select: { ...findingSelect, supportingObservations: includeSupporting } }))
      evidence.set(flag.id, { ...flag, supportingObservations: includeSupporting ? flag.supportingObservations : null })
  }
  if (ids.some(id => !evidence.has(id))) throw new SiteRunRefusal('Finding evidence changed. Try again.', 409)
  return evidence
}

async function loadCurrentIncidentScope(site: SiteRecord, improvement: { id: string; status: string }, includeSupporting = true) {
  if (site.projectId) {
    const current = await loadCurrentFindingSources([site.projectId], [{ ...improvement, projectId: site.projectId }], { includeUnbound: false })
    const sources = current.byImprovement.get(improvement.id) ?? []
    const evidence = await loadFindingEvidence(site.projectId, sources.map(source => source.flag.id), includeSupporting)
    return sources.map(source => ({ createdAt: source.createdAt, flag: { ...evidence.get(source.flag.id)!, status: source.flag.status } }))
  }
  return prisma.improvementOccurrence.findMany({
    where: { improvementId: improvement.id, audit: { id: site.primaryAuditId ?? '' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { createdAt: true, flag: { select: { id: true, auditId: true, pageUrl: true, affectedPaths: true, status: true, resolvedInId: true,
      source: true, evidence: true, fix: true, checkId: true, fingerprint: true, verificationRule: true, evidenceTargets: true, attentionPolicy: true, supportingObservations: true } } },
  })
}

async function withSelectedGuidance<T extends { id: string; fix: string }>(projectId: string, flags: T[]) {
  if (!flags.length) return flags
  const selected = await prisma.flag.findMany({ where: { id: { in: [...new Set(flags.map(flag => flag.id))] }, audit: { projectId } },
    select: { id: true, ...guidanceSelect, audit: { select: guidanceAuditSelect } } })
  const byId = new Map(selected.map(flag => [flag.id, flag]))
  return flags.map(flag => {
    const guidance = byId.get(flag.id)
    if (!guidance) return flag
    // Guidance cannot replace the already projected lifecycle or source scope.
    const { fix, agentPrompt, cursorPrompt, claudePrompt, windsurfPrompt, lovablePrompt, boltPrompt, audit } = guidance
    return { ...flag, fix, agentPrompt, cursorPrompt, claudePrompt, windsurfPrompt, lovablePrompt, boltPrompt, audit }
  })
}

const attemptVerificationSelect = { id: true, projectId: true, parentId: true, status: true, createdAt: true, completedAt: true, verifierExecutions: {
  where: { workKind: 'finalize', workState: { in: ['READY', 'RUNNING', 'RETRY_WAIT'] } }, take: 1,
  select: { workKind: true, workState: true },
} } satisfies Prisma.AuditSelect

function toSiteFlagSeed(flag: Partial<AgentPrompts> & {
  attentionPolicy?: unknown
  supportingObservations?: unknown
  supportingEvidenceUnreadable?: boolean
  repairDefinition?: RepairDefinition | null
  scopedRepairGuidance?: string
  repairScopeEvidence?: unknown
  audit?: Parameters<typeof repairGuidanceState>[0]['audit']
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
  const supportingEvidenceUnreadable = flag.supportingEvidenceUnreadable === true || hasUnreadableStoredSupportingObservations(flag.supportingObservations)
  const storedPaths = Array.isArray(flag.affectedPaths)
    ? flag.affectedPaths.filter((path): path is string => typeof path === 'string' && path.length > 0)
    : []
  const affectedPaths = [...new Set((storedPaths.length > 0 ? storedPaths : [flag.pageUrl]).filter((path): path is string => Boolean(path)))]
  const priority = flagPriority({
    severity: flag.severity,
    confidence: flag.confidence,
    affectedPageCount: affectedPaths.length,
    outcomeId: flag.relatedOutcome?.id,
    checkId: flag.checkId,
  })
  const definition = resolveRepairDefinition({ ...flag, supportingEvidenceUnreadable })
  const repairDefinition = definition && !supportingEvidenceUnreadable && definition.kind !== 'evidence-recovery' && flag.scopedRepairGuidance
    ? { ...definition, source: 'recorded' as const, guidance: flag.scopedRepairGuidance } : definition
  const fix = repairDefinition?.guidance ?? ''
  return {
    ...(supportingEvidenceUnreadable ? { supportingEvidenceUnreadable: true } : {}),
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
    whyItMatters: customerFindingExplanation(flag),
    fix,
    repairDefinition,
    repairEvidenceRevision: createHash('sha256').update(JSON.stringify({ checkId: flag.checkId,
      evidence: flag.evidence, supportingObservations: flag.supportingObservations ?? null,
      scope: flag.repairScopeEvidence ?? null, repairDefinition })).digest('hex'),
    repairGuidance: fix ? 'ready' : repairGuidanceState(flag),
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

async function projectSelectedFlags(projectId: string,
  flags: Array<Parameters<typeof toSiteFlagSeed>[0] & { auditId: string; createdAt?: Date }>) {
  const [guided, checks] = await Promise.all([withSelectedGuidance(projectId, flags), loadCurrentFlagVerifications(projectId, flags)])
  return guided.map(flag => toSiteFlagSeed({ ...flag,
    verificationState: verificationState(flag.status, checks.get(flag.id)?.verifying ?? false) })).sort(compareFlagPriority)
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
      select: {
        id: true, projectId: true, status: true, fingerprint: true,
        outcome: { select: { id: true, name: true } },
      },
    })

    const current = await loadCurrentFindingSources([site.projectId], improvements)
    const sources = [...current.byImprovement.values()].flatMap(rows => rows.map(row => row.flag))
      .concat(current.unbound.get(site.projectId) ?? [])
    const evidence = await loadFindingEvidence(site.projectId, sources.map(flag => flag.id))
    const hydrate = (source: typeof sources[number]) => ({ ...evidence.get(source.id)!, status: source.status })
    const auditFlags = (current.unbound.get(site.projectId) ?? []).map(hydrate)

    if (improvements.length > 0) {
      const projected = improvements.flatMap((imp) => {
        if (!current.represented.has(imp.id)) return []
        const occurrences = current.byImprovement.get(imp.id) ?? []
        const currentOccurrenceFlags = occurrences.map(occurrence => hydrate(occurrence.flag))
        const auditFlag = auditFlags.find(candidate => candidate.fingerprint === imp.fingerprint)
        if (currentOccurrenceFlags.length === 0 && !auditFlag) return []
        const flag = newestRecordedFlag([...currentOccurrenceFlags, ...(auditFlag ? [auditFlag] : [])])
        if (!flag) return []
        const paths = incidentAffectedPaths(currentOccurrenceFlags)
        if (auditFlag?.pageUrl) paths.push(auditFlag.pageUrl)
        const scopedRepairGuidance = currentOccurrenceFlags.some(source => source.id === flag.id)
          ? combineAccessibilityFixes(currentOccurrenceFlags) : undefined
        return [{
          ...flag,
          status: flag?.status === 'UNVERIFIED' ? 'UNVERIFIED' : siteFlagDetailStatus(imp.status, flag?.status ?? 'OPEN'),
          improvementId: imp.id,
          scopedRepairGuidance,
          ...(scopedRepairGuidance && currentOccurrenceFlags.some(source => hasUnreadableStoredSupportingObservations(source.supportingObservations))
            ? { supportingEvidenceUnreadable: true } : {}),
          repairScopeEvidence: currentOccurrenceFlags.map(source => createHash('sha256').update(JSON.stringify({
            id: source.id, evidence: source.evidence, supportingObservations: source.supportingObservations,
            verificationRule: source.verificationRule })).digest('hex')),
          affectedPaths: paths,
          relatedOutcome: imp.outcome ?? null,
          latestOccurrenceAt: occurrences.find(occurrence => occurrence.flag.id === flag.id)?.createdAt ?? flag.createdAt ?? null,
        }]
      })
      const representedFingerprints = new Set(improvements.filter(improvement => current.represented.has(improvement.id))
        .map(improvement => improvement.fingerprint))
      const selected = [
        ...projected,
        ...auditFlags.filter((flag) => !flag.fingerprint || !representedFingerprints.has(flag.fingerprint)),
      ]
      return projectSelectedFlags(site.projectId, selected)
    }

    return projectSelectedFlags(site.projectId, auditFlags)
  }

  const auditId = site.primaryAuditId
  if (!auditId) return []

  const flags = await prisma.flag.findMany({
    where: { auditId, status: { in: ['OPEN', 'REGRESSED'] } },
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    include: guidanceInclude,
  })

  return flags.map((flag) => toSiteFlagSeed(flag)).sort(compareFlagPriority)
}

export async function loadSiteFindings(site: SiteRecord): Promise<{
  flags: SiteFlagSeed[]
  recommendations: SiteFlagSeed[]
}> {
  return readSiteEvidence(site, async () => partitionCustomerFlags(withoutSlowCtaBesideMissingAction(await loadAllOpenSiteFlags(site))))
}

export async function loadSiteFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).flags
}

export async function loadSiteRecommendations(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return (await loadSiteFindings(site)).recommendations
}

export async function loadSiteResolvedFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  return readSiteEvidence(site, () => readSiteResolvedFlags(site))
}

async function readSiteResolvedFlags(site: SiteRecord): Promise<SiteFlagSeed[]> {
  if (site.kind !== 'project' || !site.projectId) return []
  const sources = await loadResolvedFindingSources(site.projectId)
  const evidence = await loadFindingEvidence(site.projectId, sources.map(item => item.source.id))
  const improvementIds = [...new Set(sources.flatMap(item => item.improvementId ?? []))]
  const improvements = improvementIds.length ? await prisma.improvement.findMany({
    where: { id: { in: improvementIds }, projectId: site.projectId },
    select: { id: true, outcome: { where: { projectId: site.projectId }, select: { id: true, name: true } } },
  }) : []
  const byId = new Map(improvements.map(improvement => [improvement.id, improvement]))
  const projected = sources.map(item => {
    const flag = evidence.get(item.source.id)!
    if (!resolvedSourceMatches(item.source, flag) ||
      (flag.improvementOccurrence?.improvementId ?? null) !== item.improvementId ||
      item.improvementId && !byId.has(item.improvementId)) throw new SiteRunRefusal('Finding evidence changed. Try again.', 409)
    return { ...flag, status: item.status, resolvedInId: item.resolvedInId, improvementId: item.improvementId,
      relatedOutcome: item.improvementId ? byId.get(item.improvementId)!.outcome : null,
      affectedPaths: item.affectedPaths, verificationState: 'verified' as const, latestOccurrenceAt: item.recoveredAt }
  })
  const guided = await withSelectedGuidance(site.projectId, projected)
  return selectResolvedFlags(guided.map((flag, index) => ({
    at: sources[index].recoveredAt?.toISOString() ?? '', seed: toSiteFlagSeed(flag),
  })))
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
  sourceFlagIds?: string[]
  repairGuidance?: RepairGuidanceState
  supportingObservations?: ReturnType<typeof publicSupportingObservations>
  supportingEvidenceUnreadable?: boolean
  supportingEvidenceRevision?: string
  supportingEvidencePage?: SupportingEvidencePage
  outcomeId: string | null
  sourceAuditId: string
  evidenceContext?: FlagEvidenceContext
  performanceEvidence?: import('@/lib/audit/performance-measurement-contract').PerformanceMeasurement[]
  performanceEvidenceSource?: 'lab' | 'field' | null
  verificationRule: string | null
  confidence: number | null
  causeCertainty: string | null
  expectedBehavior: string
  evidenceMissing: boolean
  viewport: string | null
  attempts: SiteFlagAttemptView[]
  verificationFeedback?: import('./flag-resolution').FlagVerificationFeedback | null
  activeVerificationAuditId?: string | null
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
  return readSiteEvidence(site, () => readSiteFlagDetail(site, flagId))
}

/** HTTP and MCP continuation use the same bounded evidence owner. */
export async function loadSiteRepairBriefPage(site: SiteRecord, flagId: string, appUrl: string, observationOffset = 0, expectedContextHash?: string) {
  return (await loadSiteRepairContextPage(site, flagId, appUrl, observationOffset, expectedContextHash))?.brief ?? null
}

export async function loadSiteRepairContextPage(site: SiteRecord, flagId: string, appUrl: string, observationOffset = 0, expectedContextHash?: string) {
  return readSiteEvidence(site, async () => {
    const flag = await readSiteFlagDetail(site, flagId, { observationOffset })
    return flag ? { brief: buildSiteRepairBrief(site.siteId, flag, appUrl, flagId, observationOffset, expectedContextHash),
      attempts: flag.attempts, verifying: flag.verifying } : null
  })
}

async function readSiteFlagDetail(site: SiteRecord, flagId: string, page?: { observationOffset: number }): Promise<SiteFlagDetail | null> {
  // Detail is a historical resource, independent of the open inbox and its pagination.
  let flagRow = await prisma.flag.findFirst({
    where: {
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' },
      OR: [{ id: flagId }, { improvementOccurrence: { improvementId: flagId } }],
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    omit: { supportingObservations: Boolean(page) },
    include: { improvementOccurrence: { include: { improvement: { select: { id: true, status: true, outcomeId: true } } } },
      ...guidanceInclude },
  })
  if (!flagRow) return null
  const initialImprovement = flagRow.improvementOccurrence?.improvement
  const durableLink = flagRow.id !== flagId ? initialImprovement : undefined
  const occurrenceScope = durableLink ? await loadCurrentIncidentScope(site, durableLink, !page) : []
  const activeScope = currentIncidentFlags(occurrenceScope.map(occurrence => occurrence.flag), new Set<string>())
  const bound = outcomeFlagOwner(flagRow.fingerprint)
  const currentSource = newestRecordedFlag(activeScope)
  const sourceId = currentSource?.id ?? (durableLink && bound && site.projectId
    ? await latestConfirmedOutcomeFlagId({ projectId: site.projectId, outcomeId: bound.outcomeId, improvementId: durableLink.id })
    : flagRow.id)
  // Durable incident links open the unresolved original capture. Exact Flag
  // links remain historical resources, including completed recoveries.
  if (!sourceId) return null
  if (sourceId !== flagRow.id) {
    flagRow = await prisma.flag.findFirst({ where: { id: sourceId,
      audit: site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' },
      improvementOccurrence: { improvementId: durableLink?.id },
    },
      omit: { supportingObservations: Boolean(page) },
      include: { improvementOccurrence: { include: { improvement: { select: { id: true, status: true, outcomeId: true } } } },
      ...guidanceInclude } })
    if (!flagRow) return null
  }
  const recoveries = site.projectId ? (await loadIncidentRecoveryProofs([{ projectId: site.projectId,
    flags: [flagRow] }])).get(site.projectId) : null
  const improvement = flagRow.improvementOccurrence?.improvement
  const legacyRecovery = site.projectId && improvement && flagRow.status === 'OPEN'
    ? (await loadAcceptedFlagRecoveries(site.projectId, [{ id: flagRow.id, auditId: flagRow.auditId, improvementId: improvement.id }])).get(flagRow.id) : undefined
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
          sourceFlagIds: true,
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
  const grouped = flagRow.id !== flagId && activeScope.length > 1
  const evidenceSources = grouped ? activeScope : [flagRow]
  const evidencePage = page ? await readSupportingEvidencePage(site, evidenceSources, grouped, page.observationOffset, 25) : null
  const incidentEvidence = grouped && !page ? incidentSupportingEvidence(activeScope) : null
  const supportingEvidenceUnreadable = evidencePage ? evidencePage.total === null
    : incidentEvidence?.unreadable ?? hasUnreadableStoredSupportingObservations(flagRow.supportingObservations)
  const sourceStatus = flagRow.status === 'FIXED' && !provenRecovery ? 'UNVERIFIED'
    : siteFlagDetailStatus(improvement?.status, flagRow.status, Boolean(legacyRecovery))
  const observedAt = flagRow.improvementOccurrence?.createdAt ?? flagRow.createdAt
  const currentCheck = site.projectId ? (await loadCurrentFlagVerifications(site.projectId,
    [{ id: flagRow.id, auditId: flagRow.auditId, improvementId, createdAt: observedAt }])).get(flagRow.id) : undefined
  const verifying = currentCheck?.verifying ?? false
  const scopedSeed = toSiteFlagSeed({
    ...seed,
    scopedRepairGuidance: grouped ? combineAccessibilityFixes(activeScope) : undefined,
    audit: flagRow.audit,
    supportingObservations: flagRow.supportingObservations,
    supportingEvidenceUnreadable,
    status: sourceStatus,
    resolvedInId: legacyRecovery?.auditId ?? flagRow.resolvedInId ?? null,
    affectedPaths: affectedPaths.length > 0 ? affectedPaths : seed.affectedPaths,
    latestOccurrenceAt: observedAt ?? seed.latestOccurrenceAt,
    verificationState: verificationState(sourceStatus, verifying),
  })

  return {
    ...scopedSeed,
    sourceFlagIds: flagRow.id === flagId ? [flagRow.id] : [...new Set([flagRow.id, ...activeScope.map(flag => flag.id)])],
    relatedOutcome: linkedOutcome ? { id: linkedOutcome.id, name: linkedOutcome.name } : scopedSeed.relatedOutcome,
    outcomeId: improvement?.outcomeId ?? null,
    sourceAuditId: flagRow.auditId,
    evidenceContext: flagEvidenceContext(flagRow),
    supportingObservations: evidencePage ? evidencePage.observations ?? [] : incidentEvidence?.observations ?? publicSupportingObservations(flagRow.supportingObservations),
    supportingEvidenceRevision: evidencePage?.revision ?? supportingEvidenceRevision(evidenceSources, grouped),
    ...(evidencePage ? { supportingEvidencePage: evidencePage } : {}),
    supportingEvidenceUnreadable,
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
    verifying,
    activeVerificationAuditId: currentCheck?.verifying ? currentCheck.auditId : null,
    verificationFeedback: currentCheck?.feedback ?? null,
  }
}
