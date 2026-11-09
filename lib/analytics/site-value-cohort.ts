import { ACQUISITION_FOLLOWUP_DAYS, attemptMatchesCycle, consentedGuideClaimEntry, cycleMatchesSource, fixedStartWindow, independentCycleResult,
  type AcquisitionAudit, type AcquisitionClaim, type AcquisitionCycle, type AcquisitionStart } from './acquisition-value-cohort'
import type { GuideEntry } from './guide-entry'
import { summarizeOutcomeRecoveryEvidence, type OutcomeRecoveryEvidence } from './outcome-recovery-value'
import { PUBLIC_LINK_VERIFICATION_RULE } from '@/lib/audit/checks/destination-evidence'
import type { PublicLinkFollowup } from './public-link-followup-query'

export type SiteValueFollowupDays = 7 | 28
export type ValueSite = { id: string; userId: string; createdAt: Date; deletedAt: Date | null }
export type ValueRun = { projectId: string; requestedByUserId: string | null; source: string; status: string; environment: string;
  requestedAt: Date; completedAt: Date | null; auditId: string | null }
export type OwnerClipboardHandoff = { projectId: string; occurredAt: Date; acknowledgedAt: Date; resultEventId?: string | null }
const DAY = 86_400_000
const valid = (date: Date) => Number.isFinite(date.getTime())
const inWindow = (date: Date, start: Date, end: Date) => valid(date) && date >= start && date <= end
const siteCounts = () => ({ sites: 0, completedScheduledChecks: 0, initialOrLaterIssueCycles: 0, recordedFixAttempts: 0,
  independentlyImproved: 0, completedMonitoringAfterImprovement: 0, ownerRequestedFollowup: 0,
  ownerAcknowledgedClipboardHandoff: 0, ownerClipboardHandoffWithIndependentResult: 0,
  ownerClipboardHandoffWithVerifiedImprovement: 0, verifiedPublicLinkRepair: 0,
  comparableScheduledPublicLinkRecheck: 0, publicLinkFailureAfterVerifiedRepair: 0 })
const countOnlyMeasures = new Set(['sites', 'ownerAcknowledgedClipboardHandoff',
  'ownerClipboardHandoffWithIndependentResult', 'ownerClipboardHandoffWithVerifiedImprovement', 'verifiedPublicLinkRepair',
  'comparableScheduledPublicLinkRecheck', 'publicLinkFailureAfterVerifiedRepair'])
const outcomeSiteCounts = () => ({ sitesWithRetainedAssessments: 0, sitesWithVerifiedRecovery: 0,
  sitesWithMatureRecoveryFollowup: 0, sitesWithFailureAfterScheduledPass: 0,
  sitesWithCompletedOwnerWebCheckAfterRecovery: 0 })

/** Retained Site usage after its first recorded exact claim, independent of first-scan repair source. */
export function calculateSiteValueCohort(input: { claims: AcquisitionClaim[]; sites: ValueSite[]; audits: AcquisitionAudit[];
  runs: ValueRun[]; cycles: AcquisitionCycle[]; starts: AcquisitionStart[]; since: Date; now: Date;
  startWindowEnd?: Date; followupDays?: SiteValueFollowupDays; outcomeEvidence?: OutcomeRecoveryEvidence;
  clipboardHandoffs?: OwnerClipboardHandoff[]; publicLinkFollowup?: PublicLinkFollowup }) {
  const followupDays = input.followupDays ?? 7
  if (followupDays !== 7 && followupDays !== 28) throw new Error('Invalid Site follow-up duration')
  if (!valid(input.since) || !valid(input.now) || input.since > input.now) throw new Error('Invalid Site value window')
  const window = input.startWindowEnd &&
    fixedStartWindow(input.since, input.startWindowEnd, input.now, ACQUISITION_FOLLOWUP_DAYS + followupDays)
  const first = new Map<string, AcquisitionClaim>()
  for (const claim of [...input.claims].sort((a,b) => a.createdAt.getTime()-b.createdAt.getTime())) {
    if (claim.projectId && claim.userId && valid(claim.createdAt) && claim.createdAt <= input.now &&
      claim.idempotencyKey.startsWith('analysis_claimed:') && !first.has(claim.projectId)) first.set(claim.projectId, claim)
  }
  const sites = new Map(input.sites.map(site => [site.id,site]))
  const audits = new Map(input.audits.map(audit => [audit.id,audit]))
  const starts = new Map(input.starts.map(start => [start.idempotencyKey, start]))
  const runsBySite = new Map<string,ValueRun[]>()
  for (const run of input.runs) { const rows=runsBySite.get(run.projectId)??[];rows.push(run);runsBySite.set(run.projectId,rows) }
  const cyclesBySite = new Map<string,AcquisitionCycle[]>()
  for (const cycle of input.cycles) { const rows=cyclesBySite.get(cycle.projectId)??[];rows.push(cycle);cyclesBySite.set(cycle.projectId,rows) }
  const coverage = { firstRecordedClaims: 0, immatureSites: 0, unavailableOwnerLinks: 0,
    invalidClaimLinks: 0, rejectedRuns: 0, rejectedRepairEvidence: 0, preExistingSites: 0 }
  const counts = siteCounts()
  const guideEntries = new Map<GuideEntry, ReturnType<typeof siteCounts>>()
  const outcomeCounts = input.outcomeEvidence && outcomeSiteCounts()
  const outcomesByGuide = new Map<GuideEntry, ReturnType<typeof outcomeSiteCounts>>()
  const outcomesBySite = input.outcomeEvidence && Map.groupBy(input.outcomeEvidence.observations, row => row.projectId)
  const failuresBySite = input.outcomeEvidence && Map.groupBy(input.outcomeEvidence.failures, row => row.projectId)
  const handoffsBySite = Map.groupBy(input.clipboardHandoffs ?? [], row => row.projectId)
  for (const claim of first.values()) {
    if (claim.createdAt < input.since) continue
    const initialId = claim.idempotencyKey.slice('analysis_claimed:'.length)
    const initial = audits.get(initialId)
    const start = starts.get(`analyze_started:${initialId}`)
    const guide = start && initial &&
      (!input.startWindowEnd || (start.createdAt >= input.since && start.createdAt < input.startWindowEnd))
      ? consentedGuideClaimEntry(start, initial, claim.createdAt) : undefined
    if (window && !guide) continue
    coverage.firstRecordedClaims++
    const end = new Date(claim.createdAt.getTime()+followupDays*DAY)
    if (end > input.now) { coverage.immatureSites++; continue }
    counts.sites++
    const site = sites.get(claim.projectId!)
    if (!site || site.deletedAt || site.userId !== claim.userId || !valid(site.createdAt) ||
      site.createdAt > claim.createdAt) { coverage.unavailableOwnerLinks++; continue }
    if (!initial || initial.projectId !== site.id || initial.userId !== site.userId ||
      !valid(initial.createdAt) || initial.createdAt > claim.createdAt) { coverage.invalidClaimLinks++; continue }
    if (site.createdAt < initial.createdAt) coverage.preExistingSites++
    const guideCounts = guide ? (guideEntries.get(guide) ?? siteCounts()) : undefined
    if (guide && guideCounts) {
      guideCounts.sites++
      guideEntries.set(guide, guideCounts)
    }
    const mark = (key: Exclude<keyof typeof counts, 'sites'>) => {
      counts[key]++
      if (guideCounts) guideCounts[key]++
    }
    const handoffs = (handoffsBySite.get(site.id) ?? []).filter(handoff =>
      inWindow(handoff.occurredAt, claim.createdAt, end) && inWindow(handoff.acknowledgedAt, handoff.occurredAt, end))
    if (handoffs.length) mark('ownerAcknowledgedClipboardHandoff')
    const handoffResultIds = new Set(handoffs.map(handoff => handoff.resultEventId))
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
    const ownerWebChecks = completed.filter(run => run.source === 'WEB' && run.requestedByUserId === site.userId)
    if (scheduled.length) mark('completedScheduledChecks')
    if (ownerWebChecks.some(run => run.requestedAt.getTime() >= claim.createdAt.getTime() + DAY)) mark('ownerRequestedFollowup')
    if (outcomeCounts) {
      const observations = (outcomesBySite?.get(site.id) ?? []).filter(row =>
        row.requestedAt >= claim.createdAt && row.completedAt <= end)
      const failures = (failuresBySite?.get(site.id) ?? []).filter(row => row.requestedAt >= claim.createdAt)
      const outcome = observations.length && summarizeOutcomeRecoveryEvidence({ since: claim.createdAt, now: end, observations, failures })
      const guideOutcome = guide && (outcomesByGuide.get(guide) ?? outcomeSiteCounts())
      if (guide && guideOutcome) outcomesByGuide.set(guide, guideOutcome)
      if (outcome) {
        const { counts: recovered } = outcome.report
        const hasOwnerWebCheck = ownerWebChecks.length > 0 && [...outcome.matureRecoveryWindows].some(([recovery, until]) =>
          ownerWebChecks.some(run => run.requestedAt.getTime() >= recovery.completedAt.getTime() + DAY &&
            run.completedAt && run.completedAt <= until))
        for (const row of guideOutcome ? [outcomeCounts, guideOutcome] : [outcomeCounts]) {
          row.sitesWithRetainedAssessments++
          if (recovered.verifiedRecoveredFlags) row.sitesWithVerifiedRecovery++
          if (recovered.matureRecoveredFlags) row.sitesWithMatureRecoveryFollowup++
          if (recovered.comparableFailureAfterScheduledPass) row.sitesWithFailureAfterScheduledPass++
          if (hasOwnerWebCheck) row.sitesWithCompletedOwnerWebCheckAfterRecovery++
        }
      }
    }
    let generated = false; let attempted = false; const improvements: Date[] = []
    let handoffWithIndependentResult = false
    let handoffWithVerifiedImprovement = false
    let verifiedPublicLinkRepair = false
    let comparableScheduledPublicLinkRecheck = false
    let publicLinkFailureAfterVerifiedRepair = false
    for (const cycle of (cyclesBySite.get(site.id)??[]).filter(cycle => cycle.createdAt <= end)) {
      const source = audits.get(cycle.sourceAuditId)
      if (!source || source.projectId !== site.id || source.userId !== site.userId || source.status !== 'COMPLETED' ||
        !source.startedAt || !source.completedAt || !inWindow(source.startedAt,source.createdAt,end) ||
        !inWindow(source.completedAt,source.startedAt,end) ||
        !cycleMatchesSource(cycle,source,site.id,end)) { coverage.rejectedRepairEvidence++; continue }
      // Initial materialization may precede the post-commit claim receipt.
      const start = cycle.sourceAuditId === initialId ? source.createdAt : claim.createdAt
      const events = cycle.events.filter(event => inWindow(event.occurredAt,start,end))
      const flag = cycle.occurrence?.flag
      generated ||= events.some(event => event.type === 'GENERATED')
      attempted ||= events.some(event => event.type === 'ATTEMPTED' && attemptMatchesCycle(event,cycle,end) && event.occurredAt >= event.attempt!.createdAt)
      for (const event of events.filter(event => event.type === 'OUTCOME_ISSUED')) {
        const after = event.verificationAuditId ? audits.get(event.verificationAuditId) : null
        if (!independentCycleResult(event,cycle,source,after,site.userId,end)) { coverage.rejectedRepairEvidence++; continue }
        if (event.outcome === 'IMPROVED') {
          improvements.push(event.occurredAt)
          if (after && inWindow(after.createdAt, claim.createdAt, end) &&
            flag?.checkId === 'broken-internal-links' && flag.verificationRule === PUBLIC_LINK_VERIFICATION_RULE) {
            verifiedPublicLinkRepair = true
            const rechecks = event.id ? input.publicLinkFollowup?.get(event.id) : undefined
            if (rechecks) {
              for (const run of scheduled) {
                if (!run.auditId || run.requestedAt <= event.occurredAt) continue
                const verdict = rechecks.get(run.auditId)
                comparableScheduledPublicLinkRecheck ||= verdict !== undefined
                publicLinkFailureAfterVerifiedRepair ||= verdict === 'failed'
              }
            }
          }
        }
        if (event.id && handoffResultIds.has(event.id)) {
          handoffWithIndependentResult = true
          handoffWithVerifiedImprovement ||= event.outcome === 'IMPROVED'
        }
      }
    }
    if (generated) mark('initialOrLaterIssueCycles')
    if (attempted) mark('recordedFixAttempts')
    if (handoffWithIndependentResult) mark('ownerClipboardHandoffWithIndependentResult')
    if (handoffWithVerifiedImprovement) mark('ownerClipboardHandoffWithVerifiedImprovement')
    if (verifiedPublicLinkRepair) mark('verifiedPublicLinkRepair')
    if (comparableScheduledPublicLinkRecheck) mark('comparableScheduledPublicLinkRecheck')
    if (publicLinkFailureAfterVerifiedRepair) mark('publicLinkFailureAfterVerifiedRepair')
    if (improvements.length) {
      mark('independentlyImproved')
      if (scheduled.some(run => improvements.some(time => run.requestedAt > time))) mark('completedMonitoringAfterImprovement')
    }
  }
  const partial = coverage.unavailableOwnerLinks+coverage.invalidClaimLinks+coverage.rejectedRuns+coverage.rejectedRepairEvidence > 0
  return { version: 1, status: partial?'partial':'available',
    unit: window ? 'Site with first recorded claim from a consented guide start' : 'Site with first recorded exact analysis claim',
    cohortStart:input.since.toISOString(), ...window, asOf:input.now.toISOString(), followupDays, counts, coverage,
    guideEntries: [...guideEntries].sort(([a], [b]) => a.localeCompare(b)).map(([guide, value]) => ({ guide, ...value })),
    ...(outcomeCounts && { nativeOutcomeFollowup: {
      counts: outcomeCounts,
      guideEntries: [...outcomesByGuide].sort(([a], [b]) => a.localeCompare(b)).map(([guide, value]) => ({ guide, ...value })),
      limitation: 'Both the original failed request and the independent recovery must begin at or after claim and finish inside the Site window. Recurrence and owner WEB follow-up require seven days after recovery. Owner WEB follow-up requires a completed check requested at least one day after recovery.',
    } }),
    observedSharesPct:Object.fromEntries(Object.entries(counts).filter(([key])=>!countOnlyMeasures.has(key)).map(([key,value])=>
      [key, !partial && window?.fullyMature !== false && counts.sites ? Math.round(value/counts.sites*10000)/100:null])), databaseWritten:false,
    limitations:[
      'First recorded exact claim is not necessarily the first-ever Site claim or a new customer. Pre-existing Sites are counted separately.',
      `Only complete ${followupDays}-day Site cohorts enter counts. Missing or inconsistent evidence withholds shares.`,
      'Repair proof follows each actual source audit and attempt, including later monitoring sources. Current owner and Site links must match.',
      'A completed monitor after improvement proves another check ran, not continued recovery or lack of recurrence.',
      'Owner-attributed WEB follow-up after one day is observed requested usage, not proof of a human return or paid retention.',
      'Clipboard handoffs count matched website acknowledgements for prepared repairs. Missing receipts leave coverage unknown. Acknowledgement does not establish implementation or repair.',
      'Clipboard follow-up counts require the same source and Flag scope, a frozen attempt recorded after acknowledgement, and independently issued evidence within the Site window. The sequence does not establish that the copied task caused the result.',
      'Public-link repairs require an independent improved result under the versioned response rule, with verification admitted and settled inside the claim window. This does not distinguish HTTP status or verify the interaction at the destination.',
      'Scheduled public-link follow-up uses comparable receipts for the frozen repair scope within the Site window. Missing and incomplete observations cannot establish continued recovery.',
      'Stages are independent Site-level observations, not a sequential conversion funnel, channel attribution or revenue.',
      'Guide rows require a consented label on the exact anonymous Homepage start, with the first retained claim within seven days. They count claimed Sites, including pre-existing Sites, and cannot measure visitors, guide conversion rates or causal impact.',
      'Deleted evidence and ownership changes prevent historical reconstruction. This private report does not authorize public research.',
    ] }
}
