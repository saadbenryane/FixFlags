import { prisma } from '@/lib/db'
import { isCustomerFlag } from '@/lib/audit/attention'

const DAY_MS = 24 * 60 * 60 * 1000
const OBSERVATION_DAYS = 14
const MIN_SCHEDULED_EXECUTIONS = 100
const MIN_TERMINAL_RATE = 0.99
const MAX_MONTHLY_DAILY_CARE_COST_USD = 12
const SETTLEMENT_GRACE_MS = 30 * 60 * 1000

const VALID_TARGET_FAILURE_CODES = new Set([
  'SITE_FORBIDDEN',
  'SITE_RATE_LIMITED',
  'SITE_NOT_HTML',
  'SITE_UNREACHABLE',
])

export type WatchGateStatus = 'passed' | 'failed' | 'collecting' | 'unavailable'
export type WatchLaunchStatus = WatchGateStatus

type WatchFlagEvidence = {
  id: string
  fingerprint: string | null
  status: string
  severity: string
  confidence: number | null
  impactTag: string | null
  checkId: string | null
  improvementId: string | null
}

export type WatchRunEvidence = {
  id: string
  projectId: string
  requestedAt: Date
  completedAt: Date | null
  status: string
  leaseUntil: Date | null
  errorCode: string | null
  assessments: Array<{ state: string }>
  audit: null | {
    id: string
    status: string
    failureCode: string | null
    watchRegressionCount: number | null
    watchRecoveryCount: number | null
    watchNotificationStatus: string
    watchNotificationAttempts: number
    watchNotificationLeaseUntil: Date | null
    estimatedCostUsd: number | null
    flags: WatchFlagEvidence[]
  }
}

export type WatchReadinessGate = {
  status: WatchGateStatus
  summary: string
}

export type WatchLaunchReadiness = {
  status: WatchLaunchStatus
  asOf: string
  windowStart: string
  firstWatchRequestedAt: string | null
  metrics: {
    observationDays: number
    scheduledExecutions: number
    settledExecutions: number
    targetFailuresExcluded: number
    terminalCompletions: number
    terminalCompletionRate: number | null
    lostScheduledRuns: number
    notificationAttempts: number
    durableNotificationRecords: number
    sentNotifications: number
    unchangedClearRuns: number
    unclassifiedQuietRuns: number
    quietViolations: number
    repeatedFailureGroups: number
    duplicateActiveFlagGroups: number
    costedExecutions: number
    missingCostExecutions: number
    medianWatchCostUsd: number | null
    projectedDailyCareCostUsd: number | null
  }
  gates: {
    sample: WatchReadinessGate
    terminalCompletion: WatchReadinessGate
    noLostRuns: WatchReadinessGate
    notificationRecords: WatchReadinessGate
    quietClear: WatchReadinessGate
    flagDeduplication: WatchReadinessGate
    economics: WatchReadinessGate
  }
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null
  return Math.round((numerator / denominator) * 10_000) / 100
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const ordered = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(ordered.length / 2)
  return ordered.length % 2 === 1
    ? ordered[midpoint]!
    : (ordered[midpoint - 1]! + ordered[midpoint]!) / 2
}

function validTargetFailure(run: WatchRunEvidence): boolean {
  const code = run.audit?.failureCode ?? run.errorCode
  return Boolean(code && VALID_TARGET_FAILURE_CODES.has(code))
}

function overallStatus(gates: WatchLaunchReadiness['gates']): WatchLaunchStatus {
  const statuses = Object.values(gates).map((gate) => gate.status)
  if (statuses.includes('failed')) return 'failed'
  if (statuses.includes('unavailable')) return 'unavailable'
  if (statuses.includes('collecting')) return 'collecting'
  return 'passed'
}

export function calculateWatchLaunchReadiness(input: {
  asOf: Date
  firstWatchRequestedAt: Date | null
  runs: WatchRunEvidence[]
}): WatchLaunchReadiness {
  const windowStart = new Date(input.asOf.getTime() - OBSERVATION_DAYS * DAY_MS)
  const settlementCutoff = new Date(input.asOf.getTime() - SETTLEMENT_GRACE_MS)
  const runs = input.runs.filter(
    (run) => run.requestedAt >= windowStart && run.requestedAt <= input.asOf,
  )
  const settled = runs.filter((run) => run.requestedAt <= settlementCutoff)
  const targetFailures = settled.filter(validTargetFailure)
  const comparableRuns = settled.filter((run) => !validTargetFailure(run))
  const terminalCompletions = comparableRuns.filter(
    (run) => run.status === 'COMPLETED' && run.completedAt !== null,
  ).length
  const terminalRate = comparableRuns.length > 0
    ? terminalCompletions / comparableRuns.length
    : null
  const lostRuns = settled.filter((run) =>
    run.errorCode === 'RUN_ABANDONED' ||
    ((run.status === 'QUEUED' || run.status === 'RUNNING') &&
      (run.leaseUntil === null || run.leaseUntil <= input.asOf)),
  )

  const completedAudits = settled.filter(
    (run) => run.status === 'COMPLETED' && run.audit?.status === 'COMPLETED',
  )
  const attemptedNotifications = completedAudits.filter(
    (run) => (run.audit?.watchNotificationAttempts ?? 0) > 0,
  )
  const durableNotifications = attemptedNotifications.filter((run) => {
    const audit = run.audit!
    return (audit.watchNotificationStatus === 'SENT' || audit.watchNotificationStatus === 'FAILED') &&
      audit.watchNotificationLeaseUntil === null
  })
  const sentNotifications = attemptedNotifications.filter(
    (run) => run.audit?.watchNotificationStatus === 'SENT',
  )

  let unchangedClearRuns = 0
  let unclassifiedQuietRuns = 0
  let quietViolations = 0
  for (const run of completedAudits) {
    const audit = run.audit!
    const allClear = run.assessments.length > 0 && run.assessments.every(
      (assessment) => assessment.state === 'CLEAR',
    )
    if (!allClear || audit.watchRegressionCount !== 0) continue
    if (audit.watchRecoveryCount === null) {
      unclassifiedQuietRuns += 1
      continue
    }
    if (audit.watchRecoveryCount !== 0) continue
    unchangedClearRuns += 1
    if (
      audit.watchNotificationAttempts !== 0 ||
      audit.watchNotificationStatus !== 'NOT_APPLICABLE'
    ) quietViolations += 1
  }

  const failureGroups = new Map<string, Map<string, string[]>>()
  for (const run of completedAudits) {
    for (const flag of run.audit!.flags) {
      if (!flag.fingerprint || !isCustomerFlag(flag)) continue
      if (flag.status !== 'OPEN' && flag.status !== 'REGRESSED') continue
      const key = `${run.projectId}:${flag.fingerprint}`
      const byAudit = failureGroups.get(key) ?? new Map<string, string[]>()
      const identities = byAudit.get(run.audit!.id) ?? []
      identities.push(flag.improvementId ?? `unlinked:${flag.id}`)
      byAudit.set(run.audit!.id, identities)
      failureGroups.set(key, byAudit)
    }
  }
  let repeatedFailureGroups = 0
  let duplicateActiveFlagGroups = 0
  for (const byAudit of failureGroups.values()) {
    const repeated = byAudit.size >= 2
    if (repeated) repeatedFailureGroups += 1
    const identities = new Set([...byAudit.values()].flatMap((values) => [...values]))
    const duplicatesWithinOneRun = [...byAudit.values()].some((values) => values.length > 1)
    if (duplicatesWithinOneRun || (repeated && identities.size > 1)) {
      duplicateActiveFlagGroups += 1
    }
  }

  const costEligible = completedAudits.filter((run) => !validTargetFailure(run))
  const costs = costEligible
    .map((run) => run.audit?.estimatedCostUsd ?? null)
    .filter((cost): cost is number => cost !== null && Number.isFinite(cost))
  const medianWatchCostUsd = median(costs)
  const projectedDailyCareCostUsd = medianWatchCostUsd === null
    ? null
    : medianWatchCostUsd * 30
  const missingCostExecutions = costEligible.length - costs.length

  const observationReady = input.firstWatchRequestedAt !== null &&
    input.firstWatchRequestedAt <= windowStart
  const sampleReady = observationReady && runs.length >= MIN_SCHEDULED_EXECUTIONS
  const sample: WatchReadinessGate = sampleReady
    ? { status: 'passed', summary: `${runs.length} scheduled executions across a complete 14-day window.` }
    : {
        status: 'collecting',
        summary: `${runs.length}/${MIN_SCHEDULED_EXECUTIONS} scheduled executions; ${observationReady ? '14-day window complete' : '14-day window still collecting'}.`,
      }
  const terminalCompletion: WatchReadinessGate = comparableRuns.length === 0
    ? { status: 'collecting', summary: 'No settled non-target Watch executions are available yet.' }
    : terminalRate !== null && terminalRate >= MIN_TERMINAL_RATE
      ? { status: 'passed', summary: `${percentage(terminalCompletions, comparableRuns.length)}% completed terminally; ${targetFailures.length} valid target failures excluded.` }
      : { status: 'failed', summary: `${percentage(terminalCompletions, comparableRuns.length)}% completed terminally; at least 99% is required.` }
  const noLostRuns: WatchReadinessGate = settled.length === 0
    ? { status: 'collecting', summary: 'No settled scheduled execution is available to evaluate for loss yet.' }
    : lostRuns.length === 0
      ? { status: 'passed', summary: 'No abandoned or lease-expired scheduled run was found.' }
      : { status: 'failed', summary: `${lostRuns.length} scheduled run${lostRuns.length === 1 ? '' : 's'} were abandoned or lost their lease.` }
  const notificationRecords: WatchReadinessGate = attemptedNotifications.length === 0
    ? { status: 'collecting', summary: 'No notification attempt has exercised durable delivery recording yet.' }
    : durableNotifications.length === attemptedNotifications.length
      ? { status: 'passed', summary: `${durableNotifications.length}/${attemptedNotifications.length} attempted notifications have a terminal durable record; ${sentNotifications.length} were accepted by the provider.` }
      : { status: 'failed', summary: `${attemptedNotifications.length - durableNotifications.length} attempted notifications lack a terminal durable record.` }
  const quietClear: WatchReadinessGate = quietViolations > 0
    ? { status: 'failed', summary: `${quietViolations} unchanged Clear result${quietViolations === 1 ? '' : 's'} attempted a notification.` }
    : unclassifiedQuietRuns > 0
      ? { status: 'unavailable', summary: `${unclassifiedQuietRuns} Clear result${unclassifiedQuietRuns === 1 ? '' : 's'} predate durable recovery classification.` }
      : unchangedClearRuns === 0
        ? { status: 'collecting', summary: 'No explicitly unchanged Clear result has exercised quiet-success behavior yet.' }
        : { status: 'passed', summary: `${unchangedClearRuns} unchanged Clear result${unchangedClearRuns === 1 ? '' : 's'} stayed quiet.` }
  const flagDeduplication: WatchReadinessGate = duplicateActiveFlagGroups > 0
    ? { status: 'failed', summary: `${duplicateActiveFlagGroups} repeated failure group${duplicateActiveFlagGroups === 1 ? '' : 's'} produced more than one active Flag identity.` }
    : repeatedFailureGroups === 0
      ? { status: 'collecting', summary: 'No repeated customer failure has exercised Flag deduplication yet.' }
      : { status: 'passed', summary: `${repeatedFailureGroups} repeated failure group${repeatedFailureGroups === 1 ? '' : 's'} retained one active Flag identity.` }
  const economics: WatchReadinessGate = costEligible.length === 0
    ? { status: 'collecting', summary: 'No completed Watch execution is available for cost projection yet.' }
    : missingCostExecutions > 0
      ? { status: 'unavailable', summary: `${missingCostExecutions}/${costEligible.length} completed Watch executions lack durable cost records.` }
      : projectedDailyCareCostUsd !== null && projectedDailyCareCostUsd <= MAX_MONTHLY_DAILY_CARE_COST_USD
        ? { status: 'passed', summary: `$${projectedDailyCareCostUsd.toFixed(2)} projected monthly daily-care COGS per Site from p50 Watch cost.` }
        : { status: 'failed', summary: `$${projectedDailyCareCostUsd?.toFixed(2) ?? 'N/A'} projected monthly daily-care COGS per Site exceeds $${MAX_MONTHLY_DAILY_CARE_COST_USD}.` }

  const gates = {
    sample,
    terminalCompletion,
    noLostRuns,
    notificationRecords,
    quietClear,
    flagDeduplication,
    economics,
  }

  return {
    status: overallStatus(gates),
    asOf: input.asOf.toISOString(),
    windowStart: windowStart.toISOString(),
    firstWatchRequestedAt: input.firstWatchRequestedAt?.toISOString() ?? null,
    metrics: {
      observationDays: OBSERVATION_DAYS,
      scheduledExecutions: runs.length,
      settledExecutions: settled.length,
      targetFailuresExcluded: targetFailures.length,
      terminalCompletions,
      terminalCompletionRate: terminalRate === null ? null : percentage(terminalCompletions, comparableRuns.length),
      lostScheduledRuns: lostRuns.length,
      notificationAttempts: attemptedNotifications.length,
      durableNotificationRecords: durableNotifications.length,
      sentNotifications: sentNotifications.length,
      unchangedClearRuns,
      unclassifiedQuietRuns,
      quietViolations,
      repeatedFailureGroups,
      duplicateActiveFlagGroups,
      costedExecutions: costs.length,
      missingCostExecutions,
      medianWatchCostUsd,
      projectedDailyCareCostUsd,
    },
    gates,
  }
}

type WatchReadinessClient = Pick<typeof prisma, 'runRequest'>

export async function loadWatchLaunchReadiness(
  asOf = new Date(),
  client: WatchReadinessClient = prisma,
): Promise<WatchLaunchReadiness> {
  const windowStart = new Date(asOf.getTime() - OBSERVATION_DAYS * DAY_MS)
  const [firstRun, rows] = await Promise.all([
    client.runRequest.findFirst({
      where: { source: 'WATCH', requestedAt: { lte: asOf } },
      orderBy: { requestedAt: 'asc' },
      select: { requestedAt: true },
    }),
    client.runRequest.findMany({
      where: { source: 'WATCH', requestedAt: { gte: windowStart, lte: asOf } },
      orderBy: { requestedAt: 'asc' },
      select: {
        id: true,
        projectId: true,
        requestedAt: true,
        completedAt: true,
        status: true,
        leaseUntil: true,
        errorCode: true,
        assessments: { select: { state: true } },
        audit: {
          select: {
            id: true,
            status: true,
            failureCode: true,
            watchRegressionCount: true,
            watchRecoveryCount: true,
            watchNotificationStatus: true,
            watchNotificationAttempts: true,
            watchNotificationLeaseUntil: true,
            runCost: { select: { estimatedCostUsd: true } },
            flags: {
              select: {
                id: true,
                fingerprint: true,
                status: true,
                severity: true,
                confidence: true,
                impactTag: true,
                checkId: true,
                improvementOccurrence: { select: { improvementId: true } },
              },
            },
          },
        },
      },
    }),
  ])

  return calculateWatchLaunchReadiness({
    asOf,
    firstWatchRequestedAt: firstRun?.requestedAt ?? null,
    runs: rows.map((run) => ({
      ...run,
      assessments: run.assessments.map((assessment) => ({ state: assessment.state })),
      audit: run.audit ? {
        ...run.audit,
        estimatedCostUsd: run.audit.runCost?.estimatedCostUsd.toNumber() ?? null,
        flags: run.audit.flags.map((flag) => ({
          ...flag,
          improvementId: flag.improvementOccurrence?.improvementId ?? null,
        })),
      } : null,
    })),
  })
}
