import { prisma } from '@/lib/db'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'

const START_PREFIX = 'analyze_started:'
const RESULT_PREFIX = 'first_useful_result:'

type StartEventRow = {
  idempotencyKey: string
  properties: unknown
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
  firstUsefulResult: number
  claimed: number
}

export type SiteFirstValueFunnel = {
  started: number
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
  journeyIds: string[]
  unattributedEventCount: number
  rowLimitReached: boolean
}

export type LandingFirstValueFunnel = {
  status: LandingJourneyArtifact['status'] | 'missing'
  fetchedAt: string | null
  startDate: string | null
  endDate: string | null
  landingSessions: number | null
  startedSessions: number | null
  firstUsefulResultSessions: number | null
  claimedSessions: number | null
  startRate: number | null
  resultRate: number | null
  claimRate: number | null
  instrumentedStarts: number
  unattributedEventCount: number
  rowLimitReached: boolean
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

  return {
    status: record.status,
    fetchedAt: record.fetchedAt,
    startDate: record.startDate,
    endDate: record.endDate,
    journeyIds: [...new Set(journeyIds)],
    unattributedEventCount:
      typeof record.unattributedEventCount === 'number'
        ? Math.max(0, record.unattributedEventCount)
        : 0,
    rowLimitReached: record.rowLimitReached === true,
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
}): SiteFirstValueFunnel {
  const startedIds = new Set(
    input.starts
      .filter((event) => isAnonymousStart(event.properties))
      .map((event) => eventAuditId(event.idempotencyKey, START_PREFIX))
      .filter((auditId): auditId is string => Boolean(auditId)),
  )
  const resultIds = new Set(
    input.results
      .map((event) => eventAuditId(event.idempotencyKey, RESULT_PREFIX))
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
  const sourceRows = new Map<string, FirstValueSourceRow>()
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
      firstUsefulResult: 0,
      claimed: 0,
    }
    row.started++
    if (hasResult) row.firstUsefulResult++
    if (wasClaimed) row.claimed++
    sourceRows.set(source, row)
  }

  const started = startedIds.size
  const firstUsefulResult = resultIds.size
  const landingJourneyIds = input.landingArtifact
    ? new Set(input.landingArtifact.journeyIds)
    : null
  const startedJourneyIds = new Set<string>()
  const resultJourneyIds = new Set<string>()
  const claimedJourneyIds = new Set<string>()
  if (landingJourneyIds && input.landingArtifact?.status !== 'unavailable') {
    for (const [auditId, journeyId] of journeyByAuditId) {
      if (!landingJourneyIds.has(journeyId)) continue
      startedJourneyIds.add(journeyId)
      if (resultIds.has(auditId)) resultJourneyIds.add(journeyId)
      if (auditsById.get(auditId)?.userId) claimedJourneyIds.add(journeyId)
    }
  }
  const landingSessions =
    input.landingArtifact && input.landingArtifact.status !== 'unavailable'
      ? landingJourneyIds!.size
      : null
  return {
    started,
    firstUsefulResult,
    resultRate: percentage(firstUsefulResult, started),
    claimed,
    claimRate: percentage(claimed, started),
    failedBeforeResult,
    stillRunning,
    missingAudit: started - auditsById.size,
    sources: [...sourceRows.values()].sort(
      (left, right) =>
        right.started - left.started || left.source.localeCompare(right.source),
    ),
    landing: {
      status: input.landingArtifact?.status ?? 'missing',
      fetchedAt: input.landingArtifact?.fetchedAt ?? null,
      startDate: input.landingArtifact?.startDate ?? null,
      endDate: input.landingArtifact?.endDate ?? null,
      landingSessions,
      startedSessions: landingSessions === null ? null : startedJourneyIds.size,
      firstUsefulResultSessions:
        landingSessions === null ? null : resultJourneyIds.size,
      claimedSessions: landingSessions === null ? null : claimedJourneyIds.size,
      startRate:
        landingSessions === null
          ? null
          : percentage(startedJourneyIds.size, landingSessions),
      resultRate:
        landingSessions === null
          ? null
          : percentage(resultJourneyIds.size, landingSessions),
      claimRate:
        landingSessions === null
          ? null
          : percentage(claimedJourneyIds.size, landingSessions),
      instrumentedStarts: journeyByAuditId.size,
      unattributedEventCount: input.landingArtifact?.unattributedEventCount ?? 0,
      rowLimitReached: input.landingArtifact?.rowLimitReached ?? false,
    },
  }
}

/** Cohorts starts by their immutable server event, then follows those exact audits. */
export async function loadSiteFirstValueFunnel(
  since: Date,
): Promise<SiteFirstValueFunnel> {
  const [starts, landingArtifactRow] = await Promise.all([
    prisma.siteLifecycleEvent.findMany({
      where: { name: 'analyze_started', createdAt: { gte: since } },
      select: { idempotencyKey: true, properties: true },
    }),
    prisma.growthArtifact.findUnique({
      where: { path: 'ga/rolling-28d/landing-journeys' },
      select: { payload: true },
    }),
  ])
  const landingArtifact = parseLandingJourneyArtifact(landingArtifactRow?.payload)
  const auditIds = [
    ...new Set(
      starts
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
        name: 'first_useful_result',
        idempotencyKey: {
          in: auditIds.map((auditId) => `${RESULT_PREFIX}${auditId}`),
        },
      },
      select: { idempotencyKey: true },
    }),
  ])

  return calculateSiteFirstValueFunnel({ starts, audits, results, landingArtifact })
}
