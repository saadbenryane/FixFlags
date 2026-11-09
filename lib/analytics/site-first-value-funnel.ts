import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { isAnalyticsJourneyId } from '@/lib/analytics/journey-id'
import { FIXFLAGS_LANDING_SCOPE } from '@/lib/growth/reporting-targets'
import { analysisCompletionAuditId, analysisCompletionKeys } from './analysis-completion'
import { ACQUISITION_FOLLOWUP_DAYS, observedAnalysisClaim, type AcquisitionAudit, type AcquisitionClaim } from './acquisition-value-cohort'

const START_PREFIX = 'analyze_started:'
const DAY = 86_400_000
const FOLLOWUP_MS = ACQUISITION_FOLLOWUP_DAYS * DAY
const LANDING_ARTIFACT_PATH = 'ga/rolling-28d/landing-journeys'
const MAX_LANDING_STARTS = 10_000

type StartEventRow = {
  idempotencyKey: string
  properties: unknown
  createdAt?: Date
}

type AuditRow = Pick<AcquisitionAudit, 'id' | 'createdAt' | 'userId' | 'projectId' | 'project'> & {
  status: string
  utmSource: string | null
  source: string
}

type ResultEventRow = {
  idempotencyKey: string
  createdAt: Date
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
  claimRate: number | null
  failedBeforeResult: number
  stillRunning: number
  completedWithoutReceipt: number
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
  computedAt?: string
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
  startReceiptCoverage?: { retainedStarts: number; withUsableTabKey: number; withExactLandingMatch: number } | null
  unattributedEventCount: number
  rowLimitReached: boolean
  providerLimited: boolean
  followupComplete: boolean
}

const count = z.number().int().nonnegative()
const rate = count.max(100).nullable()
const landingScopeSchema = z.object({
  property: z.literal(FIXFLAGS_LANDING_SCOPE.property),
  hostname: z.literal(FIXFLAGS_LANDING_SCOPE.hostname),
  streamId: z.literal(FIXFLAGS_LANDING_SCOPE.streamId),
  pagePath: z.literal(FIXFLAGS_LANDING_SCOPE.pagePath),
  eventName: z.literal(FIXFLAGS_LANDING_SCOPE.eventName),
})
const landingSnapshotSchema = z.object({
  version: z.union([z.literal(3), z.literal(4)]),
  scope: landingScopeSchema,
  computedAt: z.iso.datetime(),
  status: z.enum(['available', 'partial', 'unavailable', 'incomparable']),
  fetchedAt: z.iso.datetime(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  reportingTimeZone: z.string().nullable(),
  landingSessions: count.nullable(),
  startedSessions: count.nullable(),
  completedAnalysisSessions: count.nullable(),
  claimedSessions: count.nullable(),
  startRate: rate,
  resultRate: rate,
  claimRate: rate,
  unattributedEventCount: count,
  rowLimitReached: z.boolean(),
  providerLimited: z.boolean(),
  startReceiptCoverage: z.object({ retainedStarts: count, withUsableTabKey: count, withExactLandingMatch: count }).nullable().optional(),
  followupComplete: z.boolean(),
})

export type LandingJourneySnapshot = z.infer<typeof landingSnapshotSchema>

function eventAuditId(idempotencyKey: string, prefix: string): string | null {
  if (!idempotencyKey.startsWith(prefix)) return null
  const auditId = idempotencyKey.slice(prefix.length)
  return auditId && auditId === auditId.trim() ? auditId : null
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
  claims?: AcquisitionClaim[]
  asOf?: Date
  landingArtifact?: LandingJourneyArtifact | null
  landingStarts?: StartEventRow[]
}): SiteFirstValueFunnel {
  const asOf = input.asOf ?? new Date()
  const claimsByKey = new Map(input.claims?.map(claim => [claim.idempotencyKey, claim]))
  const matchesClaim = (audit: AuditRow, startAt: Date | undefined, cutoff = asOf) =>
    observedAnalysisClaim(audit, claimsByKey.get(`analysis_claimed:${audit.id}`), startAt, cutoff)
  const startTimes = new Map<string, Date>()
  const startedIds = new Set(
    input.starts
      .filter((event) => isAnonymousStart(event.properties))
      .map((event) => eventAuditId(event.idempotencyKey, START_PREFIX))
      .filter((auditId): auditId is string => Boolean(auditId)),
  )
  const completionTimes = new Map<string, Date[]>()
  for (const result of input.results) {
    const auditId = analysisCompletionAuditId(result.idempotencyKey)
    if (!auditId) continue
    const times = completionTimes.get(auditId) ?? []
    times.push(result.createdAt)
    completionTimes.set(auditId, times)
  }
  const auditsById = new Map(
    input.audits
      .filter((audit) => startedIds.has(audit.id))
      .map((audit) => [audit.id, audit]),
  )

  let claimed = 0
  let claimCoverageIncomplete = auditsById.size !== startedIds.size
  let failedBeforeResult = 0
  let stillRunning = 0
  let completedWithoutReceipt = 0
  const sourceRows = new Map<string, Omit<FirstValueSourceRow, 'firstUsefulResult'>>()
  const journeyByAuditId = new Map<string, string>()

  for (const event of input.starts) {
    if (!isAnonymousStart(event.properties)) continue
    const auditId = eventAuditId(event.idempotencyKey, START_PREFIX)
    const journeyId = eventJourneyId(event.properties)
    if (auditId && event.createdAt) startTimes.set(auditId, event.createdAt)
    if (auditId && journeyId) journeyByAuditId.set(auditId, journeyId)
  }

  for (const auditId of startedIds) {
    const audit = auditsById.get(auditId)
    if (!audit) continue

    const hasResult = completionTimes.has(auditId)
    const wasClaimed = matchesClaim(audit, startTimes.get(auditId))
    if (wasClaimed) claimed++
    else if (audit.userId || audit.projectId) claimCoverageIncomplete = true
    if (!hasResult) {
      if (audit.status === 'FAILED') failedBeforeResult++
      else if (audit.status === 'COMPLETED') completedWithoutReceipt++
      else stillRunning++
    }

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
  const analysisCompleted = [...startedIds].filter(id => completionTimes.has(id)).length
  const landingJourneyIds = input.landingArtifact
    ? new Set(input.landingArtifact.journeyIds)
    : null
  const startedJourneyIds = new Set<string>()
  const retainedStartAudits = new Set<string>()
  const keyedStartAudits = new Set<string>()
  const matchedStartAudits = new Set<string>()
  const resultJourneyIds = new Set<string>()
  const claimedJourneyIds = new Set<string>()
  const unresolvedResultJourneys = new Set<string>()
  const unresolvedClaimJourneys = new Set<string>()
  const landingStarts = input.landingStarts ?? input.starts
  const artifact = input.landingArtifact
  const exportAt = artifact ? new Date(artifact.fetchedAt) : null
  const comparableLanding = hasComparableLandingWindow(artifact) && exportAt !== null && exportAt <= asOf &&
    landingStarts.every((event) => !isAnonymousStart(event.properties) ||
      Boolean(event.createdAt && Number.isFinite(event.createdAt.getTime())))
  if (landingJourneyIds && comparableLanding) {
    const allAuditsById = new Map(input.audits.map((audit) => [audit.id, audit]))
    for (const event of landingStarts) {
      if (!isAnonymousStart(event.properties) || !event.createdAt ||
        !Number.isFinite(event.createdAt.getTime()) || event.createdAt > exportAt) continue
      const eventDate = calendarDate(event.createdAt, artifact.reportingTimeZone)
      if (eventDate < artifact.startDate || eventDate > artifact.endDate) continue
      const auditId = eventAuditId(event.idempotencyKey, START_PREFIX)
      if (!auditId) continue
      retainedStartAudits.add(auditId)
      const journeyId = eventJourneyId(event.properties)
      if (!journeyId) continue
      keyedStartAudits.add(auditId)
      if (!landingJourneyIds.has(journeyId)) continue
      matchedStartAudits.add(auditId)
      startedJourneyIds.add(journeyId)
      const audit = allAuditsById.get(auditId)
      if (!audit || !(audit.createdAt <= event.createdAt)) {
        unresolvedResultJourneys.add(journeyId)
        unresolvedClaimJourneys.add(journeyId)
        continue
      }
      const cutoff = new Date(Math.min(asOf.getTime(), event.createdAt.getTime() + FOLLOWUP_MS))
      // Dispatch precedes the start receipt, so completion can legitimately be logged first.
      if (completionTimes.get(auditId)?.some(time => time >= audit.createdAt && time <= cutoff)) resultJourneyIds.add(journeyId)
      if (matchesClaim(audit, event.createdAt, cutoff)) claimedJourneyIds.add(journeyId)
      else if ((audit.userId || audit.projectId) && !matchesClaim(audit, event.createdAt)) unresolvedClaimJourneys.add(journeyId)
    }
  }
  const landingSessions =
    comparableLanding
      ? landingJourneyIds!.size
      : null
  const completedAnalysisSessions = landingSessions === null ? null : resultJourneyIds.size
  const followupComplete = comparableLanding &&
    calendarDate(new Date(asOf.getTime() - FOLLOWUP_MS), artifact.reportingTimeZone) > artifact.endDate
  const rateDenominator = artifact?.status === 'available' ? landingSessions : null
  return {
    started,
    analysisCompleted,
    customerUsefulnessAssessed: false,
    firstUsefulResult: analysisCompleted,
    resultRate: percentage(analysisCompleted, started),
    claimed,
    claimRate: claimCoverageIncomplete || !started ? null : percentage(claimed, started),
    failedBeforeResult,
    stillRunning,
    completedWithoutReceipt,
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
      startRate: rateDenominator ? percentage(startedJourneyIds.size, rateDenominator) : null,
      resultRate: rateDenominator && followupComplete && ![...unresolvedResultJourneys].some(id => !resultJourneyIds.has(id))
        ? percentage(resultJourneyIds.size, rateDenominator) : null,
      claimRate: rateDenominator && followupComplete && ![...unresolvedClaimJourneys].some(id => !claimedJourneyIds.has(id))
        ? percentage(claimedJourneyIds.size, rateDenominator) : null,
      instrumentedStarts: journeyByAuditId.size,
      ...(artifact && { startReceiptCoverage: comparableLanding ? {
        retainedStarts: retainedStartAudits.size, withUsableTabKey: keyedStartAudits.size, withExactLandingMatch: matchedStartAudits.size,
      } : null }),
      unattributedEventCount: input.landingArtifact?.unattributedEventCount ?? 0,
      rowLimitReached: input.landingArtifact?.rowLimitReached ?? false,
      providerLimited: input.landingArtifact?.providerLimited ?? false,
      followupComplete,
    },
  }
}

/** Cohorts starts by their immutable server event, then follows those exact audits. */
export async function loadSiteFirstValueFunnel(
  since: Date,
): Promise<SiteFirstValueFunnel> {
  const asOf = new Date()
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const stored = await tx.growthArtifact.findUnique({
      where: { path: LANDING_ARTIFACT_PATH },
      select: { payload: true },
    })
    const snapshot = landingSnapshotSchema.safeParse(stored?.payload)
    const funnel = await readSiteFirstValueFunnel(tx, since, asOf)
    if (snapshot.success && new Date(snapshot.data.computedAt) <= asOf) {
      const landing = snapshot.data
      funnel.landing = { ...landing, instrumentedStarts: funnel.landing.instrumentedStarts,
        firstUsefulResultSessions: landing.completedAnalysisSessions,
        ...(landing.version === 3 && {
          status: landing.status === 'available' ? 'partial' : landing.status,
          startRate: null, resultRate: null, claimRate: null,
        }),
      }
    } else if (stored) {
      // Older exports have no proof of the source scope and cannot supply a denominator.
      funnel.landing.status = 'incomparable'
    }
    return funnel
  }, { isolationLevel: 'RepeatableRead' })
}

/** Join the provider keys within a read-only snapshot and return aggregate data only. */
export async function captureLandingJourneySnapshot(payload: unknown, asOf = new Date(),
  db: Pick<typeof prisma, '$transaction'> = prisma): Promise<LandingJourneySnapshot> {
  const source = z.object({ scope: landingScopeSchema }).safeParse(payload)
  if (!source.success) throw new Error('Landing export lacks FixFlags source scope')
  const artifact = parseLandingJourneyArtifact(payload)
  if (!artifact) throw new Error('Invalid landing journey export')
  const { landing } = await db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    return readSiteFirstValueFunnel(tx, asOf, asOf, artifact)
  }, { isolationLevel: 'RepeatableRead' })
  return landingSnapshotSchema.parse({
    ...landing, version: 4, scope: source.data.scope,
    computedAt: asOf.toISOString(), reportingTimeZone: artifact.reportingTimeZone,
  })
}

async function readSiteFirstValueFunnel(tx: Prisma.TransactionClient, since: Date, asOf: Date,
  landingArtifact: LandingJourneyArtifact | null = null) {
  if (landingArtifact && !hasComparableLandingWindow(landingArtifact)) {
    return calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], asOf, landingArtifact })
  }
  // One extra UTC day covers the earliest midnight in any GA reporting timezone.
  // Actual membership is checked against GA calendar dates below, without guessing offsets.
  const comparable = hasComparableLandingWindow(landingArtifact)
  const querySince = comparable
    ? new Date(Math.min(since.getTime(), Date.parse(`${landingArtifact.startDate}T00:00:00Z`) - DAY))
    : since
  const queryUntil = comparable
    ? new Date(Math.min(asOf.getTime(), Date.parse(`${landingArtifact.endDate}T00:00:00Z`) + 2 * DAY))
    : asOf
  const rows = await tx.siteLifecycleEvent.findMany({
    where: { name: 'analyze_started', version: 1, userId: null, createdAt: { gte: querySince, lte: queryUntil } },
    select: { idempotencyKey: true, properties: true, createdAt: true },
    ...(landingArtifact ? { take: MAX_LANDING_STARTS + 1 } : {}),
  })
  if (landingArtifact && rows.length > MAX_LANDING_STARTS) {
    return calculateSiteFirstValueFunnel({ starts: [], audits: [], results: [], asOf,
      landingArtifact: { ...landingArtifact, status: 'unavailable' } })
  }
  const landingKeys = landingArtifact ? new Set(landingArtifact.journeyIds) : null
  const allStarts = landingKeys ? rows.filter(row => {
    const key = eventJourneyId(row.properties)
    return key !== null && landingKeys.has(key)
  }) : rows
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
      asOf,
      landingArtifact,
      landingStarts: rows,
    })
  }

  const [audits, results, claims] = await Promise.all([
    tx.audit.findMany({
      where: { id: { in: auditIds } },
      select: {
        id: true,
        userId: true,
        projectId: true,
        project: { select: { id: true, userId: true, deletedAt: true } },
        createdAt: true,
        status: true,
        utmSource: true,
        source: true,
      },
    }),
    tx.siteLifecycleEvent.findMany({
      where: {
        name: { in: ['analysis_completed', 'first_useful_result'] },
        version: 1,
        createdAt: { lte: asOf },
        idempotencyKey: {
          in: auditIds.flatMap(analysisCompletionKeys),
        },
      },
      select: { idempotencyKey: true, createdAt: true },
    }),
    tx.siteLifecycleEvent.findMany({
      where: { name: 'analysis_claimed', version: 1, createdAt: { lte: asOf },
        idempotencyKey: { in: auditIds.map(id => `analysis_claimed:${id}`) } },
      select: { idempotencyKey: true, projectId: true, userId: true, createdAt: true },
    }),
  ])

  return calculateSiteFirstValueFunnel({ starts, audits, results, claims, asOf, landingArtifact, landingStarts: rows })
}
