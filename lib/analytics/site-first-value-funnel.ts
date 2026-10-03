import { prisma } from '@/lib/db'

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
  }
}

/** Cohorts starts by their immutable server event, then follows those exact audits. */
export async function loadSiteFirstValueFunnel(
  since: Date,
): Promise<SiteFirstValueFunnel> {
  const starts = await prisma.siteLifecycleEvent.findMany({
    where: { name: 'analyze_started', createdAt: { gte: since } },
    select: { idempotencyKey: true, properties: true },
  })
  const auditIds = [
    ...new Set(
      starts
        .filter((event) => isAnonymousStart(event.properties))
        .map((event) => eventAuditId(event.idempotencyKey, START_PREFIX))
        .filter((auditId): auditId is string => Boolean(auditId)),
    ),
  ]

  if (auditIds.length === 0) {
    return calculateSiteFirstValueFunnel({ starts, audits: [], results: [] })
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

  return calculateSiteFirstValueFunnel({ starts, audits, results })
}
