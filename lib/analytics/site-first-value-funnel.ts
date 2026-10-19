import { prisma } from '@/lib/db'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { analysisCompletionAuditId, analysisCompletionKeys } from './analysis-completion'

const START_PREFIX = 'analyze_started:'

type StartEventRow = {
  idempotencyKey: string
  properties: unknown
  createdAt?: Date
}

type AuditRow = {
  id: string
  userId: string | null
  status: string
  utmSource: string | null
  source: string
}

type ResultEventRow = {
  idempotencyKey: string
}

export type FirstValueSourceRow = {
  source: string
  started: number
  analysisCompleted: number
  /** @deprecated Compatibility alias for analysisCompleted, never a usefulness assessment. */
  firstUsefulResult: number
  claimed: number
}

export type SiteFirstValueFunnel = {
  started: number
  analysisCompleted: number
  customerUsefulnessAssessed: false
  /** @deprecated Compatibility alias for analysisCompleted, never a usefulness assessment. */
  firstUsefulResult: number
  resultRate: number
  claimed: number
  claimRate: number
  failedBeforeResult: number
  stillRunning: number
  missingAudit: number
  sources: FirstValueSourceRow[]
  landing: LandingFirstValueFunnel
}

export type LandingJourneyArtifact = {
  status: 'available' | 'partial' | 'unavailable'
  fetchedAt: string
  startDate: string
  endDate: string
  reportingTimeZone: string | null
  providerLimited?: boolean
  journeyIds: string[]
  unattributedEventCount: number
  rowLimitReached: boolean
}

export type LandingFirstValueFunnel = {
  status: LandingJourneyArtifact['status'] | 'missing' | 'incomparable'
  fetchedAt: string | null
  startDate: string | null
  endDate: string | null
  landingSessions: number | null
  startedSessions: number | null
  completedAnalysisSessions: number | null
  /** @deprecated Compatibility alias for completedAnalysisSessions. */
  firstUsefulResultSessions: number | null
  claimedSessions: number | null
  startRate: number | null
  resultRate: number | null
  claimRate: number | null
  instrumentedStarts: number
  unattributedEventCount: number
  rowLimitReached: boolean
  providerLimited: boolean
}

function eventAuditId(idempotencyKey: string, prefix: string): string | null {
  if (!idempotencyKey.startsWith(prefix)) return null
  const auditId = idempotencyKey.slice(prefix.length).trim()
  return auditId || null
}

function isAnonymousStart(properties: unknown): boolean {
  return Boolean(
    properties &&
    typeof properties === 'object' &&
    !Array.isArray(properties) &&
    (properties as Record<string, unknown>).anonymous === true,
  )
}

function eventJourneyId(properties: unknown): string | null {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return null
  }
  const journeyId = (properties as Record<string, unknown>).journeyId
  return isAnalyticsJourneyId(journeyId) ? journeyId : null
}

export function parseLandingJourneyArtifact(payload: unknown): LandingJourneyArtifact | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const record = payload as Record<string, unknown>
  if (
    record.status !== 'available' &&
    record.status !== 'partial' &&
    record.status !== 'unavailable'
  ) {
    return null
  }
  if (
    typeof record.fetchedAt !== 'string' ||
    typeof record.startDate !== 'string' ||
    typeof record.endDate !== 'string' ||
    !Array.isArray(record.journeys)
  ) {
    return null
  }
  const journeyIds = record.journeys
    .map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? (row as Record<string, unknown>).journeyId
        : null,
    )
    .filter((journeyId): journeyId is string => isAnalyticsJourneyId(journeyId))
  const providerLimited = record.providerLimited === true
  const unattributedEventCount = record.unattributedEventCount ?? 0
  if (typeof unattributedEventCount !== 'number' || !Number.isSafeInteger(unattributedEventCount) || unattributedEventCount < 0) return null

  return {
    status: record.status === 'unavailable' ? 'unavailable' :
      record.status === 'partial' || providerLimited || record.rowLimitReached === true ||
      unattributedEventCount > 0 || journeyIds.length !== record.journeys.length ? 'partial' : 'available',
    fetchedAt: record.fetchedAt,
    startDate: record.startDate,
    endDate: record.endDate,
    reportingTimeZone: typeof record.reportingTimeZone === 'string' ? record.reportingTimeZone : null,
    providerLimited,
    journeyIds: [...new Set(journeyIds)],
    unattributedEventCount,
    rowLimitReached: record.rowLimitReached === true,
  }
}

function calendarDate(value: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const part = (type: string) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function hasComparableLandingWindow(artifact: LandingJourneyArtifact | null | undefined): artifact is LandingJourneyArtifact & { reportingTimeZone: string } {
  if (!artifact?.reportingTimeZone || artifact.status === 'unavailable') return false
  try {
    for (const date of [artifact.startDate, artifact.endDate]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return false
    }
    return artifact.startDate <= artifact.endDate &&
      artifact.endDate <= calendarDate(new Date(artifact.fetchedAt), artifact.reportingTimeZone)
  } catch {
    return false
  }
}

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function acquisitionSource(audit: AuditRow): string {
  return (
    audit.utmSource?.trim() || audit.source.toLowerCase().replaceAll('_', ' ')
  )
}

/**
 * Reconstructs one immutable anonymous-start cohort. Audit ownership is read
 * only after cohort membership is fixed, so a successful claim cannot remove
 * that start from the denominator.
 */
export function calculateSiteFirstValueFunnel(input: {
  starts: StartEventRow[]
  audits: AuditRow[]
  results: ResultEventRow[]
  landingArtifact?: LandingJourneyArtifact | null
  landingStarts?: StartEventRow[]
}): SiteFirstValueFunnel {
  const startedIds = new Set(
    input.starts
      .filter((event) => isAnonymousStart(event.properties))
      .map((event) => eventAuditId(event.idempotencyKey, START_PREFIX))
      .filter((auditId): auditId is string => Boolean(auditId)),
  )
  const resultIds = new Set(
    input.results
      .map((event) => analysisCompletionAuditId(event.idempotencyKey))
      .filter((auditId): auditId is string => auditId !== null)
      .filter((auditId) => startedIds.has(auditId)),
  )
  const auditsById = new Map(
    input.audits
      .filter((audit) => startedIds.has(audit.id))
      .map((audit) => [audit.id, audit]),
  )

  let claimed = 0
  let failedBeforeResult = 0
  let stillRunning = 0
  const sourceRows = new Map<string, Omit<FirstValueSourceRow, 'firstUsefulResult'>>()
  const journeyByAuditId = new Map<string, string>()

  for (const event of input.starts) {
    if (!isAnonymousStart(event.properties)) continue
    const auditId = eventAuditId(event.idempotencyKey, START_PREFIX)
    const journeyId = eventJourneyId(event.properties)
    if (auditId && journeyId) journeyByAuditId.set(auditId, journeyId)
  }

  for (const auditId of startedIds) {
    const audit = auditsById.get(auditId)
    if (!audit) continue

    const hasResult = resultIds.has(auditId)
    const wasClaimed = Boolean(audit.userId)
    if (wasClaimed) claimed++
    if (!hasResult && audit.status === 'FAILED') failedBeforeResult++
    if (!hasResult && audit.status !== 'FAILED') stillRunning++

    const source = acquisitionSource(audit)
    const row = sourceRows.get(source) ?? {
      source,
      started: 0,
      analysisCompleted: 0,
      claimed: 0,
    }
    row.started++
    if (hasResult) row.analysisCompleted++
    if (wasClaimed) row.claimed++
    sourceRows.set(source, row)
  }

  const started = startedIds.size
  const analysisCompleted = resultIds.size
  const landingJourneyIds = input.landingArtifact
    ? new Set(input.landingArtifact.journeyIds)
    : null
  const startedJourneyIds = new Set<string>()
  const resultJourneyIds = new Set<string>()
  const claimedJourneyIds = new Set<string>()
  const landingStarts = input.landingStarts ?? input.starts
  const comparableLanding = hasComparableLandingWindow(input.landingArtifact) &&
    landingStarts.every((event) => !isAnonymousStart(event.properties) ||
      Boolean(event.createdAt && Number.isFinite(event.createdAt.getTime())))
  if (landingJourneyIds && comparableLanding) {
    const artifact = input.landingArtifact!
    const allResultIds = new Set(input.results.map((result) => analysisCompletionAuditId(result.idempotencyKey)))
    const allAuditsById = new Map(input.audits.map((audit) => [audit.id, audit]))
    for (const event of landingStarts) {
      if (!isAnonymousStart(event.properties) || !event.createdAt ||
        !Number.isFinite(event.createdAt.getTime()) || event.createdAt > new Date(artifact.fetchedAt)) continue
      const eventDate = calendarDate(event.createdAt, artifact.reportingTimeZone!)
      if (eventDate < artifact.startDate || eventDate > artifact.endDate) continue
      const auditId = eventAuditId(event.idempotencyKey, START_PREFIX)
      const journeyId = eventJourneyId(event.properties)
      if (!auditId || !journeyId) continue
      if (!landingJourneyIds.has(journeyId)) continue
      startedJourneyIds.add(journeyId)
      if (allResultIds.has(auditId)) resultJourneyIds.add(journeyId)
      if (allAuditsById.get(auditId)?.userId) claimedJourneyIds.add(journeyId)
    }
  }
  const landingSessions =
    comparableLanding
      ? landingJourneyIds!.size
      : null
  const completedAnalysisSessions = landingSessions === null ? null : resultJourneyIds.size
  return {
    started,
    analysisCompleted,
    customerUsefulnessAssessed: false,
    firstUsefulResult: analysisCompleted,
    resultRate: percentage(analysisCompleted, started),
    claimed,
    claimRate: percentage(claimed, started),
    failedBeforeResult,
    stillRunning,
    missingAudit: started - auditsById.size,
    sources: [...sourceRows.values()].map(row => ({ ...row, firstUsefulResult: row.analysisCompleted })).sort(
      (left, right) =>
        right.started - left.started || left.source.localeCompare(right.source),
    ),
    landing: {
      status: input.landingArtifact && input.landingArtifact.status !== 'unavailable' && !comparableLanding
        ? 'incomparable' : input.landingArtifact?.status ?? 'missing',
      fetchedAt: input.landingArtifact?.fetchedAt ?? null,
      startDate: input.landingArtifact?.startDate ?? null,
      endDate: input.landingArtifact?.endDate ?? null,
      landingSessions,
      startedSessions: landingSessions === null ? null : startedJourneyIds.size,
      completedAnalysisSessions,
      firstUsefulResultSessions: completedAnalysisSessions,
      claimedSessions: landingSessions === null ? null : claimedJourneyIds.size,
      startRate:
        landingSessions === null || landingSessions === 0
          ? null
          : percentage(startedJourneyIds.size, landingSessions),
      resultRate:
        landingSessions === null || landingSessions === 0
          ? null
          : percentage(resultJourneyIds.size, landingSessions),
      claimRate:
        landingSessions === null || landingSessions === 0
          ? null
          : percentage(claimedJourneyIds.size, landingSessions),
      instrumentedStarts: journeyByAuditId.size,
      unattributedEventCount: input.landingArtifact?.unattributedEventCount ?? 0,
      rowLimitReached: input.landingArtifact?.rowLimitReached ?? false,
      providerLimited: input.landingArtifact?.providerLimited ?? false,
    },
  }
}

/** Cohorts starts by their immutable server event, then follows those exact audits. */
export async function loadSiteFirstValueFunnel(
  since: Date,
): Promise<SiteFirstValueFunnel> {
  const landingArtifactRow = await prisma.growthArtifact.findUnique({
    where: { path: 'ga/rolling-28d/landing-journeys' },
    select: { payload: true },
  })
  const landingArtifact = parseLandingJourneyArtifact(landingArtifactRow?.payload)
  // One extra UTC day covers the earliest midnight in any GA reporting timezone.
  // Actual membership is checked against GA calendar dates below, without guessing offsets.
  const querySince = hasComparableLandingWindow(landingArtifact)
    ? new Date(Math.min(since.getTime(), Date.parse(`${landingArtifact.startDate}T00:00:00Z`) - 86_400_000))
    : since
  const allStarts = await prisma.siteLifecycleEvent.findMany({
    where: { name: 'analyze_started', createdAt: { gte: querySince } },
    select: { idempotencyKey: true, properties: true, createdAt: true },
  })
  const starts = allStarts.filter((event) => event.createdAt >= since)
  const auditIds = [
    ...new Set(
      allStarts
        .filter((event) => isAnonymousStart(event.properties))
        .map((event) => eventAuditId(event.idempotencyKey, START_PREFIX))
        .filter((auditId): auditId is string => Boolean(auditId)),
    ),
  ]

  if (auditIds.length === 0) {
    return calculateSiteFirstValueFunnel({
      starts,
      audits: [],
      results: [],
      landingArtifact,
      landingStarts: allStarts,
    })
  }

  const [audits, results] = await Promise.all([
    prisma.audit.findMany({
      where: { id: { in: auditIds } },
      select: {
        id: true,
        userId: true,
        status: true,
        utmSource: true,
        source: true,
      },
    }),
    prisma.siteLifecycleEvent.findMany({
      where: {
        name: { in: ['analysis_completed', 'first_useful_result'] },
        idempotencyKey: {
          in: auditIds.flatMap(analysisCompletionKeys),
        },
      },
      select: { idempotencyKey: true },
    }),
  ])

  return calculateSiteFirstValueFunnel({ starts, audits, results, landingArtifact, landingStarts: allStarts })
}
