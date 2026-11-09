import { prisma } from '@/lib/db'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { UPTIME_INTERVAL_MS, uptimeTimelineBounds, uptimeTimelineSegments, type ProbeResult,
  type UptimeHistory, type UptimePeriodEvidence, type UptimeProbeView, type UptimeSummary } from './domain'
import { uptimeProjectInclude } from './eligibility'
import { uptimeHistorySchema, uptimeSummarySchema } from './contracts'
import { projectUptimeStatus, uptimeStatusMonitorSelect, uptimeStatusProjectSelect, type UptimeStatus } from './status'
import { readSiteEvidence, type SiteEvidenceScope } from '@/lib/sites/application/site-evidence-read'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { recordedUptimeFinalUrl } from './probe'
import type { Project, UptimeMonitor } from '@prisma/client'

function windowStart(window: UptimeHistory['window'], now: Date) {
  return new Date(now.getTime() - (window === '24h' ? 1 : window === '7d' ? 7 : 30) * 86400_000)
}
const projectionSelect = { id: true, ...uptimeStatusMonitorSelect, project: { include: uptimeProjectInclude } } as const
const statusProjectSelect = { ...uptimeStatusProjectSelect, watchTargetRevision: true,
  uptimeMonitor: { select: { id: true, ...uptimeStatusMonitorSelect } } } as const

type UptimeSnapshot<T> = {
  project: Pick<Project, 'url' | 'watchTargetRevision' | 'watchPausedAt' | 'watchInterval'>
  monitor: Pick<UptimeMonitor, 'id' | 'version' | 'targetUrl' | 'enabled' | 'state' | 'lastCheckedAt' | 'nextProbeAt' | 'confirmationDueAt'> | null
  value: T
}

export class InvalidUptimeCursorError extends Error {
  constructor() { super('Invalid uptime cursor'); this.name = 'InvalidUptimeCursorError' }
}

const localCursorKey = randomBytes(32)
const signedCursor = /^u1\.([a-zA-Z0-9_-]{1,100})\.([a-zA-Z0-9_-]{43})$/
type ProbeScope = { monitorId: string; version: number; targetUrl: string }

function cursorSignature(scope: ProbeScope, window: UptimeHistory['window'], probeId: string) {
  return createHmac('sha256', process.env.BETTER_AUTH_SECRET || localCursorKey)
    .update('fixflags-uptime-history-v1:')
    .update(JSON.stringify([scope.monitorId, scope.version, scope.targetUrl, window, probeId])).digest('base64url')
}

function readCursor(cursor: string, scope: ProbeScope, window: UptimeHistory['window']) {
  const match = signedCursor.exec(cursor)
  if (!match || !timingSafeEqual(Buffer.from(match[2]), Buffer.from(cursorSignature(scope, window, match[1]))))
    throw new InvalidUptimeCursorError()
  return match[1]
}

/** Check the scope in one statement after collecting evidence. Retry once
 * rather than returning a current status or cursor assembled across an edit. */
async function readCurrentUptime<T>(site: SiteEvidenceScope, read: (projectId: string) => Promise<UptimeSnapshot<T> | null>): Promise<T | null> {
  const projectId = site.kind === 'project' ? site.projectId : null
  if (!projectId) return null
  const result = await readSiteEvidence(site, async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await read(projectId)
      if (!snapshot) return { value: null }
      const { project, monitor, value } = snapshot
      const current = await prisma.project.findFirst({ where: { id: projectId,
        url: project.url, watchTargetRevision: project.watchTargetRevision, watchPausedAt: project.watchPausedAt, watchInterval: project.watchInterval,
        uptimeMonitor: monitor ? { is: { id: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl,
          enabled: monitor.enabled, state: monitor.state, lastCheckedAt: monitor.lastCheckedAt,
          nextProbeAt: monitor.nextProbeAt, confirmationDueAt: monitor.confirmationDueAt } } : { is: null },
      }, select: { id: true } })
      if (current) return { value }
    }
    return null
  })
  if (result) return result.value
  throw new SiteRunRefusal('Uptime changed while it was loading. Try again.', 409, 'UPTIME_READ_CHANGED')
}

async function readTimelinePeriods(scope: ProbeScope,
  bounds: ReturnType<typeof uptimeTimelineBounds>, now: Date) {
  const start = new Date(bounds.start).toISOString()
  // Choose each exact observation's last valid attempt before consolidating
  // retained off-cadence timestamps into their shared five-minute slot.
  const rows = await prisma.$queryRaw<Array<UptimePeriodEvidence & { startAt: Date }>>`
    WITH observations AS (
      SELECT DISTINCT ON ("scheduledAt") "scheduledAt", result, confirmed
      FROM uptime_probes
      WHERE "monitorId" = ${scope.monitorId} AND version = ${scope.version} AND "targetUrl" = ${scope.targetUrl}
        AND "scheduledAt" >= ${start}::timestamp AND "scheduledAt" < ${new Date(bounds.end).toISOString()}::timestamp
        AND "observedAt" >= "scheduledAt" AND "observedAt" <= ${now.toISOString()}::timestamp
      ORDER BY "scheduledAt", attempt DESC, "observedAt" DESC
    )
    SELECT date_bin(${bounds.span}::int * interval '1 millisecond', "scheduledAt", ${start}::timestamp) AS "startAt",
      count(DISTINCT date_bin(${UPTIME_INTERVAL_MS}::int * interval '1 millisecond', "scheduledAt", ${start}::timestamp))::int AS checked,
      bool_or(result = 'FAILED' AND confirmed) AS failed, bool_and(result = 'ONLINE') AS "allOnline"
    FROM observations
    GROUP BY 1
  `
  return new Map(rows.map(row => [row.startAt.getTime(), row]))
}

async function readUptime(projectId: string, window: UptimeHistory['window'], cursor: string | null, now: Date, includeHistory: boolean): Promise<UptimeSnapshot<UptimeHistory> | null> {
  const bounds = uptimeTimelineBounds(now, window)
  const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId }, select: projectionSelect })
  if (!monitor) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: uptimeProjectInclude })
    if (!project || project.deletedAt) return null
    if (cursor) throw new InvalidUptimeCursorError()
    return { project, monitor: null, value: { ...projectUptimeStatus(project, null, now), openIncidentCount: 0,
      segments: uptimeTimelineSegments(bounds, new Map()), window, probes: [], incidents: [], nextCursor: null } }
  }
  if (monitor.project.deletedAt) return null
  const target = normalizeAuditUrl(monitor.project.url)
  const targetMatches = target.ok && target.url === monitor.targetUrl
  const from = windowStart(window, now)
  const scope = { monitorId: monitor.id, version: monitor.version, targetUrl: target.ok ? target.url : '', observedAt: { gte: from, lte: now } }
  let before: { observedAt: Date; id: string } | null = null
  if (cursor) {
    if (!targetMatches) throw new InvalidUptimeCursorError()
    const id = readCursor(cursor, scope, window)
    before = await prisma.uptimeProbe.findFirst({ where: { ...scope, id }, select: { id: true, observedAt: true } })
    if (!before) throw new InvalidUptimeCursorError()
  }
  const [periods, rows, incidents] = await Promise.all([
    targetMatches ? readTimelinePeriods(scope, bounds, now) : new Map<number, UptimePeriodEvidence>(),
    includeHistory && targetMatches ? prisma.uptimeProbe.findMany({ where: { ...scope, ...(before ? { OR: [{ observedAt: { lt: before.observedAt, gte: from } }, { observedAt: before.observedAt, id: { lt: before.id } }] } : {}) },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 101 }) : [],
    includeHistory ? prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id, startedAt: { lte: now }, OR: [
      { confirmedAt: { gte: from } }, { recoveredAt: null, supersededAt: null },
      { recoveredAt: { gte: from } }, { supersededAt: { gte: from } },
    ] },
      orderBy: { confirmedAt: 'desc' }, take: 100 }) : [],
  ])
  const openIncidentCount = monitor.incidents.filter(incident => incident.version === monitor.version).length
  const probes: UptimeProbeView[] = rows.slice(0, 100).map(row => ({ id: row.id, targetUrl: row.targetUrl,
    scheduledAt: row.scheduledAt.toISOString(), observedAt: row.observedAt.toISOString(), attempt: row.attempt,
    result: row.result as ProbeResult, confirmed: row.confirmed, reason: row.reason,
    statusCode: row.statusCode, durationMs: row.durationMs, finalUrl: recordedUptimeFinalUrl(row) }))
  // The Site URL can change before the monitor retargets. The new URL stays
  // unknown. An open incident remains open until that retarget supersedes it.
  const lastProbe = rows.length > 100 ? probes.at(-1) : undefined
  const value = uptimeHistorySchema.parse({ ...projectUptimeStatus(monitor.project, monitor, now), openIncidentCount,
    historyScope: { key: `${monitor.id}:${monitor.version}`, from: from.toISOString(), through: now.toISOString() },
    segments: uptimeTimelineSegments(bounds, periods),
    window, probes, incidents: incidents.map(row => ({ id: row.id, targetUrl: row.targetUrl, reason: row.reason, failureOrigin: row.failureOrigin,
      startedAt: row.startedAt.toISOString(), confirmedAt: row.confirmedAt.toISOString(), recoveredAt: row.recoveredAt?.toISOString() ?? null, supersededAt: row.supersededAt?.toISOString() ?? null })),
    nextCursor: lastProbe ? `u1.${lastProbe.id}.${cursorSignature(scope, window, lastProbe.id)}` : null })
  return { project: monitor.project, monitor, value }
}

export async function loadUptimeHistory(site: SiteEvidenceScope, window: UptimeHistory['window'] = '24h', cursor: string | null = null, now = new Date()): Promise<UptimeHistory | null> {
  return readCurrentUptime(site, projectId => readUptime(projectId, window, cursor, now, true))
}

export async function loadUptimeSummary(site: SiteEvidenceScope, now = new Date()): Promise<UptimeSummary | null> {
  const projection = await readCurrentUptime(site, projectId => readUptime(projectId, '24h', null, now, false))
  return projection ? uptimeSummarySchema.parse(projection) : null
}

/** Current attention needs only the owned target and active incident scope,
 * never the probe samples required to render a history timeline. */
export async function loadUptimeStatus(site: SiteEvidenceScope, now = new Date()): Promise<UptimeStatus | null> {
  return readCurrentUptime(site, async projectId => {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: statusProjectSelect })
    return project && !project.deletedAt ? { project, monitor: project.uptimeMonitor,
      value: projectUptimeStatus(project, project.uptimeMonitor, now) } : null
  })
}

export async function loadUptimeEvents(site: SiteEvidenceScope) {
  const projectId = site.kind === 'project' ? site.projectId : null
  if (!projectId) return []
  return readSiteEvidence(site, async () => {
    const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId }, select: { id: true } })
    return monitor ? prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id }, orderBy: { confirmedAt: 'desc' }, take: 50,
      select: { id: true, targetUrl: true, startedAt: true, confirmedAt: true, recoveredAt: true, supersededAt: true, reason: true } }) : []
  })
}
