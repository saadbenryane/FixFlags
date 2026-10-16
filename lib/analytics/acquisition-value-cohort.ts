export const ACQUISITION_FOLLOWUP_DAYS = 7
const START_PREFIX = 'analyze_started:'
const RESULT_PREFIXES = ['analysis_completed:', 'first_useful_result:']
const DAY = 86_400_000
const SURFACES = new Set(['HOMEPAGE', 'TOOL_PAGE', 'ISSUE_PAGE', 'BENCHMARK_PAGE', 'REPORT', 'API', 'MCP', 'DASHBOARD', 'UNKNOWN'])

export type AcquisitionStart = {
  idempotencyKey: string; properties: unknown; createdAt: Date; userId: string | null; version: number
}
export type AcquisitionAudit = {
  id: string; userId: string | null; projectId: string | null; parentId: string | null;
  source: string; status: string; createdAt: Date; startedAt: Date | null; completedAt: Date | null;
  project: { id: string; userId: string; deletedAt: Date | null } | null
}
export type AcquisitionClaim = { idempotencyKey: string; projectId: string | null; userId: string | null; createdAt: Date }
export type AcquisitionResult = { idempotencyKey: string; createdAt: Date }
export type AcquisitionCycle = {
  id: string; projectId: string; sourceAuditId: string; improvementId: string; createdAt: Date;
  improvement: { projectId: string };
  occurrence: { improvementId: string; auditId: string; flag: { auditId: string; createdAt: Date } } | null;
  events: Array<{
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

type Stages = {
  starts: number; usefulResultReceipts: number; claimReceipts: number;
  initialIssueCycles: number; recordedFixAttempts: number; issuedVerificationResults: number; independentlyImproved: number
}
const stages = (): Stages => ({ starts: 0, usefulResultReceipts: 0, claimReceipts: 0,
  initialIssueCycles: 0, recordedFixAttempts: 0, issuedVerificationResults: 0, independentlyImproved: 0 })
const validDate = (date: Date) => Number.isFinite(date.getTime())
const within = (date: Date, start: Date, end: Date) => validDate(date) && date >= start && date <= end
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
  claims: AcquisitionClaim[]; cycles: AcquisitionCycle[]; since: Date; now: Date
}) {
  if (!validDate(input.since) || !validDate(input.now) || input.since > input.now) throw new Error('Invalid acquisition window')
  const audits = new Map(input.audits.map((audit) => [audit.id, audit]))
  const resultsByAudit = new Map<string, AcquisitionResult[]>()
  for (const result of input.results) {
    const prefix = RESULT_PREFIXES.find(value => result.idempotencyKey.startsWith(value))
    if (!prefix) continue
    const id = result.idempotencyKey.slice(prefix.length)
    group(resultsByAudit, id, result)
  }
  const claimsByProject = new Map<string | null, AcquisitionClaim[]>()
  for (const claim of input.claims) group(claimsByProject, claim.projectId, claim)
  const cyclesByAudit = new Map<string, AcquisitionCycle[]>()
  for (const cycle of input.cycles) group(cyclesByAudit, cycle.sourceAuditId, cycle)
  const starts = new Map<string, AcquisitionStart>()
  for (const row of input.starts) {
    const auditId = anonymousAcquisitionAuditId(row)
    if (auditId && within(row.createdAt, input.since, input.now) && !starts.has(auditId)) starts.set(auditId, row)
  }
  const total = stages()
  const surfaces = new Map<string, Stages>()
  const coverage = { recordedAnonymousStarts: starts.size, excludedSeedOrFollowupStarts: 0,
    immatureStarts: 0, missingSourceAudits: 0, invalidSourceDates: 0,
    unavailableOwnerLinks: 0, currentlyOwnedWithoutClaimReceipt: 0, invalidCycleLineage: 0, rejectedVerificationReceipts: 0 }

  for (const [auditId, start] of starts) {
    const audit = audits.get(auditId)
    if (audit && (audit.source === 'SEED' || audit.parentId)) { coverage.excludedSeedOrFollowupStarts++; continue }
    const end = new Date(start.createdAt.getTime() + ACQUISITION_FOLLOWUP_DAYS * DAY)
    if (end > input.now) { coverage.immatureStarts++; continue }
    const surface = audit && SURFACES.has(audit.source) ? audit.source : 'UNKNOWN'
    const row = surfaces.get(surface) ?? stages()
    surfaces.set(surface, row); row.starts++; total.starts++
    if (!audit) { coverage.missingSourceAudits++; continue }
    if (!validDate(audit.createdAt) || audit.createdAt > start.createdAt) { coverage.invalidSourceDates++; continue }
    const mark = (key: Exclude<keyof Stages, 'starts'>) => { row[key]++; total[key]++ }
    if (resultsByAudit.get(auditId)?.some((result) => within(result.createdAt, audit.createdAt, end))) mark('usefulResultReceipts')
    const project = audit.project
    const owned = project && !project.deletedAt && project.id === audit.projectId && audit.userId === project.userId
    if (!owned) {
      if (audit.projectId || audit.userId) coverage.unavailableOwnerLinks++
      continue
    }
    const claimed = claimsByProject.get(project.id)?.some((claim) => claim.userId === project.userId &&
      claim.idempotencyKey === `analysis_claimed:${auditId}` && within(claim.createdAt, audit.createdAt, end))
    if (claimed) mark('claimReceipts')
    else coverage.currentlyOwnedWithoutClaimReceipt++
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
  const partial = coverage.missingSourceAudits > 0 || coverage.invalidSourceDates > 0 ||
    coverage.unavailableOwnerLinks > 0 || coverage.invalidCycleLineage > 0 || coverage.rejectedVerificationReceipts > 0
  const claimPartial = coverage.currentlyOwnedWithoutClaimReceipt > 0
  const summary = (value: Stages) => ({ ...value, observedSharesPct: Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== 'starts').map(([key, count]) =>
      [key, !partial && value.starts > 0 && (key !== 'claimReceipts' || !claimPartial) ? Math.round(count / value.starts * 10_000) / 100 : null]),
  ) })
  return { version: 1, status: partial || claimPartial ? 'partial' : 'available', unit: 'anonymous-initial-analysis',
    cohortStart: input.since.toISOString(), asOf: input.now.toISOString(), followupDays: ACQUISITION_FOLLOWUP_DAYS,
    matureCohort: summary(total), surfaces: [...surfaces].sort(([a], [b]) => a.localeCompare(b)).map(([surface, value]) => ({ surface, ...summary(value) })),
    coverage, databaseWritten: false,
    limitations: [
      'Cohort membership uses recorded anonymous start time. Only starts with a complete seven-day observation period enter stage counts.',
      'Counts are initial analyses, not visitors, customers or unique Sites. Stages are independent evidence counts, not a sequential funnel.',
      'Entry surfaces are declared or inferred. No external acquisition channel, causal attribution or revenue is inferred.',
      'Claims require the exact analysis claim receipt and a matching current owner/Site link. Missing or legacy Site-only receipts leave the transition unclassified.',
      'Fixes and system-issued results must reference the exact initial source audit, matching cycle and attempt, and a completed independent run in the same Site. Later monitoring issues are excluded.',
      'Improved means a retained independently issued result within the window, not ongoing recovery, causal impact or a new replay of check accuracy.',
      'Missing telemetry is not proof that an action never occurred. Ownership changes and deleted evidence prevent reconstruction of past state.',
      'This private operational report is not permission to publish customer research.',
    ],
  }
}
