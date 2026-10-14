import { attemptMatchesCycle, cycleMatchesSource, independentCycleResult,
  type AcquisitionAudit, type AcquisitionClaim, type AcquisitionCycle } from './acquisition-value-cohort'

export type ValueSite = { id: string; userId: string; createdAt: Date; deletedAt: Date | null }
export type ValueRun = { projectId: string; requestedByUserId: string | null; source: string; status: string; environment: string;
  requestedAt: Date; completedAt: Date | null; auditId: string | null }
const DAY = 86_400_000
const valid = (date: Date) => Number.isFinite(date.getTime())
const inWindow = (date: Date, start: Date, end: Date) => valid(date) && date >= start && date <= end

/** Retained Site usage after its first recorded exact claim, independent of first-scan repair source. */
export function calculateSiteValueCohort(input: { claims: AcquisitionClaim[]; sites: ValueSite[]; audits: AcquisitionAudit[];
  runs: ValueRun[]; cycles: AcquisitionCycle[]; since: Date; now: Date }) {
  if (!valid(input.since) || !valid(input.now) || input.since > input.now) throw new Error('Invalid Site value window')
  const first = new Map<string, AcquisitionClaim>()
  for (const claim of [...input.claims].sort((a,b) => a.createdAt.getTime()-b.createdAt.getTime())) {
    if (claim.projectId && claim.userId && valid(claim.createdAt) && claim.createdAt <= input.now &&
      claim.idempotencyKey.startsWith('analysis_claimed:') && !first.has(claim.projectId)) first.set(claim.projectId, claim)
  }
  const sites = new Map(input.sites.map(site => [site.id,site]))
  const audits = new Map(input.audits.map(audit => [audit.id,audit]))
  const runsBySite = new Map<string,ValueRun[]>()
  for (const run of input.runs) { const rows=runsBySite.get(run.projectId)??[];rows.push(run);runsBySite.set(run.projectId,rows) }
  const cyclesBySite = new Map<string,AcquisitionCycle[]>()
  for (const cycle of input.cycles) { const rows=cyclesBySite.get(cycle.projectId)??[];rows.push(cycle);cyclesBySite.set(cycle.projectId,rows) }
  const coverage = { firstRecordedClaims: 0, immatureSites: 0, unavailableOwnerLinks: 0,
    invalidClaimLinks: 0, rejectedRuns: 0, rejectedRepairEvidence: 0, preExistingSites: 0 }
  const counts = { sites: 0, completedScheduledChecks: 0, initialOrLaterIssueCycles: 0, recordedFixAttempts: 0,
    independentlyImproved: 0, completedMonitoringAfterImprovement: 0, ownerRequestedFollowup: 0 }
  for (const claim of first.values()) {
    if (claim.createdAt < input.since) continue
    coverage.firstRecordedClaims++
    const end = new Date(claim.createdAt.getTime()+7*DAY)
    if (end > input.now) { coverage.immatureSites++; continue }
    counts.sites++
    const site = sites.get(claim.projectId!)
    if (!site || site.deletedAt || site.userId !== claim.userId || !valid(site.createdAt) ||
      site.createdAt > claim.createdAt) { coverage.unavailableOwnerLinks++; continue }
    const initialId = claim.idempotencyKey.slice('analysis_claimed:'.length)
    const initial = audits.get(initialId)
    if (!initial || initial.projectId !== site.id || initial.userId !== site.userId ||
      !valid(initial.createdAt) || initial.createdAt > claim.createdAt) { coverage.invalidClaimLinks++; continue }
    if (site.createdAt < initial.createdAt) coverage.preExistingSites++
    const completed = (runsBySite.get(site.id)??[]).filter(run => run.environment==='production' && inWindow(run.requestedAt,claim.createdAt,end)).filter(run => {
      if (run.status !== 'COMPLETED') return false
      const audit = run.auditId ? audits.get(run.auditId) : null
      const proven = audit && audit.projectId === site.id && audit.userId === site.userId && audit.status === 'COMPLETED' &&
        run.completedAt && audit.completedAt && inWindow(run.completedAt,run.requestedAt,end) &&
        audit.startedAt && inWindow(audit.startedAt,run.requestedAt,end) && valid(audit.createdAt) &&
        audit.createdAt <= audit.startedAt && inWindow(audit.completedAt,audit.startedAt,run.completedAt)
      if (!proven) coverage.rejectedRuns++
      return Boolean(proven)
    })
    const scheduled = completed.filter(run => run.source === 'WATCH')
    if (scheduled.length) counts.completedScheduledChecks++
    if (completed.some(run => run.source === 'WEB' && run.requestedByUserId === site.userId &&
      run.requestedAt >= new Date(claim.createdAt.getTime()+DAY))) counts.ownerRequestedFollowup++
    let generated = false; let attempted = false; const improvements: Date[] = []
    for (const cycle of (cyclesBySite.get(site.id)??[]).filter(cycle => cycle.createdAt <= end)) {
      const source = audits.get(cycle.sourceAuditId)
      if (!source || source.projectId !== site.id || source.userId !== site.userId || source.status !== 'COMPLETED' ||
        !source.startedAt || !source.completedAt || !inWindow(source.startedAt,source.createdAt,end) ||
        !inWindow(source.completedAt,source.startedAt,end) ||
        !cycleMatchesSource(cycle,source,site.id,end)) { coverage.rejectedRepairEvidence++; continue }
      // Initial materialization may precede the post-commit claim receipt.
      const start = cycle.sourceAuditId === initialId ? source.createdAt : claim.createdAt
      const events = cycle.events.filter(event => inWindow(event.occurredAt,start,end))
      generated ||= events.some(event => event.type === 'GENERATED')
      attempted ||= events.some(event => event.type === 'ATTEMPTED' && attemptMatchesCycle(event,cycle,end) && event.occurredAt >= event.attempt!.createdAt)
      for (const event of events.filter(event => event.type === 'OUTCOME_ISSUED')) {
        const after = event.verificationAuditId ? audits.get(event.verificationAuditId) : null
        if (!independentCycleResult(event,cycle,source,after,site.userId,end)) { coverage.rejectedRepairEvidence++; continue }
        if (event.outcome === 'IMPROVED') improvements.push(event.occurredAt)
      }
    }
    if (generated) counts.initialOrLaterIssueCycles++
    if (attempted) counts.recordedFixAttempts++
    if (improvements.length) {
      counts.independentlyImproved++
      if (scheduled.some(run => improvements.some(time => run.requestedAt > time))) counts.completedMonitoringAfterImprovement++
    }
  }
  const partial = coverage.unavailableOwnerLinks+coverage.invalidClaimLinks+coverage.rejectedRuns+coverage.rejectedRepairEvidence > 0
  return { version: 1, status: partial?'partial':'available', unit:'Site with first recorded exact analysis claim',
    cohortStart:input.since.toISOString(), asOf:input.now.toISOString(), followupDays:7, counts, coverage,
    observedSharesPct:Object.fromEntries(Object.entries(counts).filter(([key])=>key!=='sites').map(([key,value])=>
      [key, !partial && counts.sites ? Math.round(value/counts.sites*10000)/100:null])), databaseWritten:false,
    limitations:[
      'First recorded exact claim is not necessarily the first-ever Site claim or a new customer. Pre-existing Sites are counted separately.',
      'Only complete seven-day Site cohorts enter counts. Missing or inconsistent evidence withholds shares.',
      'Repair proof follows each actual source audit and attempt, including later monitoring sources. Current owner and Site links must match.',
      'A completed monitor after improvement proves another check ran, not continued recovery or lack of recurrence.',
      'Owner-attributed WEB follow-up after one day is observed requested usage, not proof of a human return or paid retention.',
      'Stages are independent Site-level observations, not a sequential conversion funnel, channel attribution or revenue.',
      'Deleted evidence and ownership changes prevent historical reconstruction. This private report does not authorize public research.',
    ] }
}
