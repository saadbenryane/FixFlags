import { analysisCompletionAuditId } from './analysis-completion'
import { isGuideEntry, type GuideEntry } from './guide-entry'
import { isAnalyticsJourneyId } from './journey-id'

export const ACQUISITION_FOLLOWUP_DAYS = 7
const START_PREFIX = 'analyze_started:'
const DAY = 86_400_000
const SURFACES = new Set(['HOMEPAGE', 'TOOL_PAGE', 'ISSUE_PAGE', 'BENCHMARK_PAGE', 'REPORT', 'API', 'MCP', 'DASHBOARD', 'UNKNOWN'])
const NONTERMINAL_AUDIT_STATES = new Set(['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING'])
const REPORTABLE_FAILURE_CODES = new Set([
  'SITE_UNREACHABLE', 'SITE_FORBIDDEN', 'HTTP_FORBIDDEN', 'SITE_RATE_LIMITED', 'SITE_NOT_HTML',
  'AUDIT_TIMEOUT', 'AUDIT_HARD_DEADLINE', 'AUDIT_PIPELINE_FAILED', 'AUDIT_JOB_FAILED', 'AUDIT_JOB_LOST',
  'AUDIT_JOB_NON_TERMINAL', 'QUEUE_ENQUEUE_FAILED', 'EXECUTION_LEASE_EXPIRED',
  'DESKTOP_CAPTURE_FAILED', 'BROWSER_LAUNCH_FAILED', 'BROWSER_CONTEXT_TERMINATED', 'BROWSER_SCOPE_UNAVAILABLE',
  'STORAGE_NOT_CONFIGURED', 'STORAGE_UPLOAD_FAILED', 'AI_CONTRACT_INVALID', 'AI_REVIEW_FAILED',
  'AI_PROVIDER_NOT_CONFIGURED', 'AI_BUDGET_UNAVAILABLE', 'FINALIZATION_INCOMPLETE',
])

export type AcquisitionStart = {
  idempotencyKey: string; properties: unknown; createdAt: Date; userId: string | null; version: number
}
export type AcquisitionAudit = {
  id: string; userId: string | null; projectId: string | null; parentId: string | null;
  source: string; status: string; createdAt: Date; startedAt: Date | null; completedAt: Date | null;
  failureCode?: string | null;
  project: { id: string; userId: string; deletedAt: Date | null } | null
}
export type AcquisitionClaim = { idempotencyKey: string; projectId: string | null; userId: string | null; createdAt: Date }
export type AcquisitionResult = { idempotencyKey: string; createdAt: Date }
export type AcquisitionAdmissionCoverage =
  | { status: 'observed'; retainedMatureAdmissions: number; missingStartReceipts: number; unusableStartReceipts: number; startReceiptsOutsideWindow: number }
  | { status: 'admission-limit-exceeded' }
export type AcquisitionCycle = {
  id: string; projectId: string; sourceAuditId: string; improvementId: string; createdAt: Date;
  improvement: { projectId: string };
  occurrence: { improvementId: string; auditId: string; flag: {
    id?: string; auditId: string; createdAt: Date; checkId?: string | null; verificationRule?: string | null;
  } } | null;
  events: Array<{
    id?: string;
    type: string; transport: string; occurredAt: Date; outcome: string | null;
    attemptId: string | null; verificationAuditId: string | null;
    attempt: { id: string; sourceAuditId: string; improvementId: string; createdAt: Date } | null;
  }>
}

export function anonymousAcquisitionAuditId(start: AcquisitionStart): string | null {
  if (start.version !== 1 || start.userId !== null || !start.idempotencyKey.startsWith(START_PREFIX) ||
    !start.properties || typeof start.properties !== 'object' || Array.isArray(start.properties) ||
    (start.properties as Record<string, unknown>).anonymous !== true) return null
  return start.idempotencyKey.slice(START_PREFIX.length).trim() || null
}

type GuideSourceAudit = Pick<AcquisitionAudit, 'id' | 'source' | 'parentId' | 'createdAt'>

export function consentedGuideEntry(start: AcquisitionStart, audit: GuideSourceAudit): GuideEntry | undefined {
  if (audit.source !== 'HOMEPAGE' || audit.parentId || start.idempotencyKey !== START_PREFIX + audit.id ||
    anonymousAcquisitionAuditId(start) !== audit.id) return undefined
  const { guideEntry, journeyId } = start.properties as Record<string, unknown>
  return isGuideEntry(guideEntry) && isAnalyticsJourneyId(journeyId) ? guideEntry : undefined
}

export function consentedGuideClaimEntry(start: AcquisitionStart, audit: GuideSourceAudit, claimedAt: Date): GuideEntry | undefined {
  if (!within(start.createdAt, audit.createdAt, claimedAt) || claimedAt.getTime() - start.createdAt.getTime() > ACQUISITION_FOLLOWUP_DAYS * DAY) return undefined
  return consentedGuideEntry(start, audit)
}

type Stages = {
  starts: number; analysisCompletionReceipts: number; claimReceipts: number;
  initialIssueCycles: number; recordedFixAttempts: number; issuedVerificationResults: number; independentlyImproved: number
}
const stages = (): Stages => ({ starts: 0, analysisCompletionReceipts: 0, claimReceipts: 0,
  initialIssueCycles: 0, recordedFixAttempts: 0, issuedVerificationResults: 0, independentlyImproved: 0 })
const validDate = (date: Date) => Number.isFinite(date.getTime())
const within = (date: Date, start: Date, end: Date) => validDate(date) && date >= start && date <= end
const processingGapCounts = () => ({
  failedBeforeRecordedStart: 0, failedWithinFollowup: 0, failedAfterFollowup: 0,
  failedWithoutUsableTime: 0, recordedNonterminal: 0, unverifiedAuditState: 0,
})
const processingEvidenceCounts = () => ({
  receiptWithinFollowup: 0,
  completedAuditWithinFollowupWithoutReceipt: 0,
  completedAuditAfterFollowupWithoutReceipt: 0,
  noDatedCompletionWithoutReceipt: 0,
})
const guideAcquisitionCounts = () => ({
  stages: stages(),
  processingEvidence: processingEvidenceCounts(),
  processingGaps: processingGapCounts(),
  claimReceiptsWithCompletionReceipt: 0,
})

function processingGap(audit: AcquisitionAudit, startAt: Date, end: Date, now: Date): keyof ReturnType<typeof processingGapCounts> {
  if (audit.status !== 'FAILED') return NONTERMINAL_AUDIT_STATES.has(audit.status) ? 'recordedNonterminal' : 'unverifiedAuditState'
  const terminalAt = audit.completedAt
  if (!terminalAt || !within(terminalAt, audit.createdAt, now) ||
    (audit.startedAt && !within(audit.startedAt, audit.createdAt, terminalAt))) return 'failedWithoutUsableTime'
  if (terminalAt < startAt) return 'failedBeforeRecordedStart'
  return terminalAt <= end ? 'failedWithinFollowup' : 'failedAfterFollowup'
}

export function observedAnalysisClaim(
  audit: Pick<AcquisitionAudit, 'id' | 'createdAt' | 'userId' | 'projectId' | 'project'>,
  claim: AcquisitionClaim | undefined, startAt: Date | undefined, asOf: Date,
) {
  const project = audit.project
  return Boolean(startAt && within(startAt, audit.createdAt, asOf) && project && !project.deletedAt &&
    audit.projectId === project.id && audit.userId === project.userId &&
    claim && claim.idempotencyKey === `analysis_claimed:${audit.id}` &&
    claim.projectId === project.id && claim.userId === project.userId && within(claim.createdAt, startAt, asOf))
}

export function fixedStartWindow(since: Date, end: Date, now: Date, matureAfterDays: number) {
  if (!validDate(since) || !validDate(end) || !validDate(now) || since >= end || end > now) {
    throw new Error('Invalid fixed start window')
  }
  const matureAt = new Date(end.getTime() + matureAfterDays * DAY)
  return { cohortEndExclusive: end.toISOString(), fullyMatureAt: matureAt.toISOString(), fullyMature: now >= matureAt }
}
function group<K, T>(map: Map<K, T[]>, key: K, value: T) {
  const rows = map.get(key)
  if (rows) rows.push(value)
  else map.set(key, [value])
}

export function cycleMatchesSource(cycle: AcquisitionCycle, audit: AcquisitionAudit, projectId: string, end: Date): boolean {
  return cycle.projectId === projectId && cycle.improvement.projectId === projectId &&
    Boolean(cycle.occurrence && cycle.occurrence.improvementId === cycle.improvementId &&
      cycle.occurrence.auditId === audit.id && cycle.occurrence.flag.auditId === audit.id &&
      within(cycle.occurrence.flag.createdAt, audit.createdAt, end) && within(cycle.createdAt, audit.createdAt, end))
}

export function attemptMatchesCycle(event: AcquisitionCycle['events'][number], cycle: AcquisitionCycle, end: Date): boolean {
  return Boolean(cycle.occurrence && event.attempt && event.attempt.id === event.attemptId &&
    event.attempt.sourceAuditId === cycle.sourceAuditId && event.attempt.improvementId === cycle.improvementId &&
    within(event.attempt.createdAt, cycle.occurrence.flag.createdAt, end))
}

export function independentCycleResult(event: AcquisitionCycle['events'][number], cycle: AcquisitionCycle,
  source: AcquisitionAudit, verification: AcquisitionAudit | null | undefined, owner: string, end: Date): boolean {
  return Boolean(event.type === 'OUTCOME_ISSUED' && event.transport === 'SYSTEM' && attemptMatchesCycle(event, cycle, end) &&
    verification && verification.id !== source.id && verification.projectId === cycle.projectId && verification.userId === owner &&
    verification.status === 'COMPLETED' && verification.startedAt && verification.completedAt &&
    within(verification.startedAt, event.attempt!.createdAt, end) &&
    within(verification.createdAt, event.attempt!.createdAt, verification.startedAt) &&
    within(verification.completedAt, verification.startedAt, event.occurredAt) &&
    ['IMPROVED', 'UNCHANGED', 'REGRESSED', 'INCONCLUSIVE'].includes(event.outcome ?? ''))
}

/** Follows exact initial audit identities. Never attributes another Site's or later scan's repairs. */
export function calculateAcquisitionValueCohort(input: {
  starts: AcquisitionStart[]; audits: AcquisitionAudit[]; results: AcquisitionResult[];
  claims: AcquisitionClaim[]; cycles: AcquisitionCycle[]; since: Date; now: Date; startWindowEnd?: Date
  admissionReceiptCoverage?: AcquisitionAdmissionCoverage
}) {
  if (!validDate(input.since) || !validDate(input.now) || input.since > input.now) throw new Error('Invalid acquisition window')
  const window = input.startWindowEnd && fixedStartWindow(input.since, input.startWindowEnd, input.now, ACQUISITION_FOLLOWUP_DAYS)
  const audits = new Map(input.audits.map((audit) => [audit.id, audit]))
  const resultsByAudit = new Map<string, AcquisitionResult[]>()
  for (const result of input.results) {
    const id = analysisCompletionAuditId(result.idempotencyKey)
    if (!id) continue
    group(resultsByAudit, id, result)
  }
  const claimsByKey = new Map(input.claims.map(claim => [claim.idempotencyKey, claim]))
  const cyclesByAudit = new Map<string, AcquisitionCycle[]>()
  for (const cycle of input.cycles) group(cyclesByAudit, cycle.sourceAuditId, cycle)
  const starts = new Map<string, AcquisitionStart>()
  for (const row of input.starts) {
    const auditId = anonymousAcquisitionAuditId(row)
    if (auditId && within(row.createdAt, input.since, input.now) &&
      (!input.startWindowEnd || row.createdAt < input.startWindowEnd) && !starts.has(auditId)) starts.set(auditId, row)
  }
  const total = stages()
  const surfaces = new Map<string, Stages>()
  const guideEntries = new Map<GuideEntry, ReturnType<typeof guideAcquisitionCounts>>()
  const processingGaps = processingGapCounts()
  const failureCodes = new Map<string, number>()
  const processingEvidence = { ...processingEvidenceCounts(), unavailableSource: 0 }
  const coverage = { recordedAnonymousStarts: starts.size, excludedSeedOrFollowupStarts: 0,
    immatureStarts: 0, missingSourceAudits: 0, invalidSourceDates: 0,
    unavailableOwnerLinks: 0, currentlyOwnedWithoutClaimReceipt: 0, claimReceiptBeforeStart: 0, claimReceiptAfterFollowup: 0,
    invalidCycleLineage: 0, rejectedVerificationReceipts: 0 }

  for (const [auditId, start] of starts) {
    const audit = audits.get(auditId)
    if (audit && (audit.source === 'SEED' || audit.parentId)) { coverage.excludedSeedOrFollowupStarts++; continue }
    const end = new Date(start.createdAt.getTime() + ACQUISITION_FOLLOWUP_DAYS * DAY)
    if (end > input.now) { coverage.immatureStarts++; continue }
    const surface = audit && SURFACES.has(audit.source) ? audit.source : 'UNKNOWN'
    const row = surfaces.get(surface) ?? stages()
    surfaces.set(surface, row); row.starts++; total.starts++
    if (!audit) {
      coverage.missingSourceAudits++
      processingEvidence.unavailableSource++
      continue
    }
    if (!validDate(audit.createdAt) || audit.createdAt > start.createdAt) {
      coverage.invalidSourceDates++
      processingEvidence.unavailableSource++
      continue
    }
    const guide = consentedGuideEntry(start, audit)
    const guideRow = guide && (guideEntries.get(guide) ?? guideAcquisitionCounts())
    if (guide && guideRow) {
      guideEntries.set(guide, guideRow)
      guideRow.stages.starts++
    }
    const mark = (key: Exclude<keyof Stages, 'starts'>) => {
      row[key]++
      total[key]++
      if (guideRow) guideRow.stages[key]++
    }
    const markProcessing = (key: keyof ReturnType<typeof processingEvidenceCounts>) => {
      processingEvidence[key]++
      if (guideRow) guideRow.processingEvidence[key]++
    }
    const hasCompletionReceipt = resultsByAudit.get(auditId)?.some(result => within(result.createdAt, audit.createdAt, end))
    if (hasCompletionReceipt) {
      mark('analysisCompletionReceipts')
      markProcessing('receiptWithinFollowup')
    } else if (audit.status === 'COMPLETED' && audit.startedAt && audit.completedAt &&
      within(audit.startedAt, audit.createdAt, input.now) && within(audit.completedAt, audit.startedAt, input.now)) {
      markProcessing(audit.completedAt <= end ? 'completedAuditWithinFollowupWithoutReceipt' : 'completedAuditAfterFollowupWithoutReceipt')
    } else {
      markProcessing('noDatedCompletionWithoutReceipt')
      const gap = processingGap(audit, start.createdAt, end, input.now)
      processingGaps[gap]++
      if (guideRow) guideRow.processingGaps[gap]++
      if (audit.status === 'FAILED') {
        const code = !audit.failureCode ? 'unrecorded' : REPORTABLE_FAILURE_CODES.has(audit.failureCode) ? audit.failureCode : 'unrecognized'
        failureCodes.set(code, (failureCodes.get(code) ?? 0) + 1)
      }
    }
    const project = audit.project
    const owned = project && !project.deletedAt && project.id === audit.projectId && audit.userId === project.userId
    if (!owned) {
      if (audit.projectId || audit.userId) coverage.unavailableOwnerLinks++
      continue
    }
    const claim = claimsByKey.get(`analysis_claimed:${auditId}`)
    if (observedAnalysisClaim(audit, claim, start.createdAt, end)) {
      mark('claimReceipts')
      if (guideRow && hasCompletionReceipt) guideRow.claimReceiptsWithCompletionReceipt++
    } else {
      coverage.currentlyOwnedWithoutClaimReceipt++
      if (claim && observedAnalysisClaim(audit, claim, audit.createdAt, input.now)) {
        if (claim.createdAt < start.createdAt) coverage.claimReceiptBeforeStart++
        if (claim.createdAt > end) coverage.claimReceiptAfterFollowup++
      }
    }
    let generated = false; let attempted = false; let issued = false; let improved = false
    for (const cycle of cyclesByAudit.get(auditId) ?? []) {
      if (cycle.createdAt > end || cycle.occurrence && cycle.occurrence.flag.createdAt > end) continue
      if (!cycleMatchesSource(cycle, audit, project.id, end)) { coverage.invalidCycleLineage++; continue }
      const events = cycle.events.filter((event) => within(event.occurredAt, audit.createdAt, end))
      generated ||= events.some((event) => event.type === 'GENERATED')
      const matchingAttempt = (event: AcquisitionCycle['events'][number]) => attemptMatchesCycle(event, cycle, end)
      attempted ||= events.some((event) => event.type === 'ATTEMPTED' && matchingAttempt(event) && event.occurredAt >= event.attempt!.createdAt)
      for (const event of events.filter((event) => event.type === 'OUTCOME_ISSUED')) {
        const verification = event.verificationAuditId ? audits.get(event.verificationAuditId) : null
        if (!independentCycleResult(event, cycle, audit, verification, project.userId, end)) {
          coverage.rejectedVerificationReceipts++; continue
        }
        issued = true
        improved ||= event.outcome === 'IMPROVED'
      }
    }
    if (generated) mark('initialIssueCycles')
    if (attempted) mark('recordedFixAttempts')
    if (issued) mark('issuedVerificationResults')
    if (improved) mark('independentlyImproved')
  }
  const admission = input.admissionReceiptCoverage
  const admissionGap = admission && (admission.status === 'admission-limit-exceeded' ||
    admission.missingStartReceipts > 0 || admission.unusableStartReceipts > 0 || admission.startReceiptsOutsideWindow > 0)
  const partial = admissionGap || coverage.missingSourceAudits > 0 || coverage.invalidSourceDates > 0 ||
    coverage.unavailableOwnerLinks > 0 || coverage.invalidCycleLineage > 0 || coverage.rejectedVerificationReceipts > 0
  const claimPartial = coverage.currentlyOwnedWithoutClaimReceipt > 0
  const summary = (value: Stages) => {
    const shares = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'starts').map(([key, count]) =>
      [key, !partial && window?.fullyMature !== false && value.starts > 0 && (key !== 'claimReceipts' || !claimPartial)
        ? Math.round(count / value.starts * 10_000) / 100 : null]))
    const observedSharesPct: Record<string, number | null> = { ...shares, usefulResultReceipts: shares.analysisCompletionReceipts }
    return { ...value,
      // Retain the old JSON field for compatibility. It has always counted completion receipts.
      usefulResultReceipts: value.analysisCompletionReceipts,
      observedSharesPct }
  }
  return { version: 1, customerUsefulnessAssessed: false, status: partial || claimPartial ? 'partial' : 'available', unit: 'anonymous-initial-analysis',
    cohortStart: input.since.toISOString(), ...window, asOf: input.now.toISOString(), followupDays: ACQUISITION_FOLLOWUP_DAYS,
    matureCohort: summary(total), surfaces: [...surfaces].sort(([a], [b]) => a.localeCompare(b)).map(([surface, value]) => ({ surface, ...summary(value) })),
    guideEntries: [...guideEntries].sort(([a], [b]) => a.localeCompare(b)).map(([guide, { stages, ...diagnostics }]) => ({
      guide, ...summary(stages), ...diagnostics,
    })),
    coverage, processingEvidence, processingGaps,
    recordedFailureCodes: [...failureCodes].sort(([a], [b]) => a.localeCompare(b)).map(([code, audits]) => ({ code, audits })),
    ...(admission && { admissionReceiptCoverage: admission }), databaseWritten: false,
    limitations: [
      'Analysis-completion receipts measure finished processing, not customer usefulness. usefulResultReceipts is a compatibility alias for analysisCompletionReceipts. Owner feedback, published repairs and verified recovery require their own evidence.',
      'Processing evidence partitions mature starts. Completed audit rows without a qualifying receipt indicate recorded processing, not result delivery or a customer action. Missing or invalid audit links cannot qualify a receipt.',
      'Processing gaps refine the no-dated-completion count. Failure codes describe retained classifications, not root causes. Nonterminal records do not establish that work is still running.',
      'Cohort membership uses recorded anonymous start time. Only starts with a complete seven-day observation period enter stage counts.',
      ...(admission ? ['The admission check looks for missing start receipts using retained provisional pointers and exact claims. It cannot reconstruct every admission or assign a guide to a missing receipt.'] : []),
      'Counts are initial analyses, not visitors, customers or unique Sites. Stages are independent evidence counts, not a sequential funnel.',
      'Entry surfaces are declared or inferred. No external acquisition channel, causal attribution or revenue is inferred.',
      'Guide entries are a subset of recorded Homepage starts with a declared guide label and a consented journey key. They do not measure guide visits, all guide starts, or the effect of any individual guide change.',
      'Claims require the exact analysis claim receipt and a matching current owner/Site link. Missing or legacy Site-only receipts leave the transition unclassified.',
      'Fixes and system-issued results must reference the exact initial source audit, matching cycle and attempt, and a completed independent run in the same Site. Later monitoring issues are excluded.',
      'Improved means a retained independently issued result within the window, not ongoing recovery, causal impact or a new replay of check accuracy.',
      'Missing telemetry is not proof that an action never occurred. Ownership changes and deleted evidence prevent reconstruction of past state.',
      'This private operational report is not permission to publish customer research.',
    ],
  }
}
