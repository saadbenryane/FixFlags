import { prisma } from '@/lib/db'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { uptimeTimeline, type ProbeResult, type UptimeHistory, type UptimeProbeView, type UptimeSummary } from './domain'
import { uptimeProjectInclude } from './eligibility'
import { uptimeCursorSchema, uptimeHistorySchema, uptimeSummarySchema } from './contracts'
import { projectUptimeStatus, uptimeStatusMonitorSelect } from './status'

function windowStart(window: UptimeHistory['window'], now: Date) {
  return new Date(now.getTime() - (window === '24h' ? 1 : window === '7d' ? 7 : 30) * 86400_000)
}
const projectionSelect = { id: true, ...uptimeStatusMonitorSelect, project: { include: uptimeProjectInclude } } as const

export class InvalidUptimeCursorError extends Error {
  constructor() { super('Invalid uptime cursor'); this.name = 'InvalidUptimeCursorError' }
}

async function readUptime(projectId: string, window: UptimeHistory['window'], cursor: string | null, now: Date, includeHistory: boolean): Promise<UptimeHistory | null> {
  const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId }, select: projectionSelect })
  if (!monitor) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: uptimeProjectInclude })
    if (!project || project.deletedAt) return null
    if (cursor) throw new InvalidUptimeCursorError()
    return { ...projectUptimeStatus(project, null, now), openIncidentCount: 0, segments: uptimeTimeline([], now, window),
      window, probes: [], incidents: [], nextCursor: null }
  }
  if (monitor.project.deletedAt) return null
  const target = normalizeAuditUrl(monitor.project.url)
  const from = windowStart(window, now)
  const scope = { monitorId: monitor.id, version: monitor.version, targetUrl: target.ok ? target.url : '', observedAt: { gte: from, lte: now } }
  let before: { observedAt: Date; id: string } | null = null
  if (cursor) {
    const id = uptimeCursorSchema.safeParse(cursor)
    if (!id.success) throw new InvalidUptimeCursorError()
    before = await prisma.uptimeProbe.findFirst({ where: { ...scope, id: id.data }, select: { id: true, observedAt: true } })
    if (!before) throw new InvalidUptimeCursorError()
  }
  const [samples, rows, incidents, openIncidentCount] = await Promise.all([
    prisma.uptimeProbe.findMany({ where: scope, select: { scheduledAt: true, observedAt: true, attempt: true, result: true, confirmed: true }, take: 18_000, orderBy: { observedAt: 'desc' } }),
    includeHistory ? prisma.uptimeProbe.findMany({ where: { ...scope, ...(before ? { OR: [{ observedAt: { lt: before.observedAt, gte: from } }, { observedAt: before.observedAt, id: { lt: before.id } }] } : {}) },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 101 }) : [],
    includeHistory ? prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id, startedAt: { lte: now }, OR: [{ confirmedAt: { gte: from } }, { recoveredAt: null, supersededAt: null }, { recoveredAt: { gte: from } }] },
      orderBy: { confirmedAt: 'desc' }, take: 100 }) : [],
    prisma.uptimeIncident.count({ where: { monitorId: monitor.id, version: monitor.version, recoveredAt: null, supersededAt: null } }),
  ])
  const probes: UptimeProbeView[] = rows.slice(0, 100).map(row => ({ id: row.id, targetUrl: row.targetUrl,
    scheduledAt: row.scheduledAt.toISOString(), observedAt: row.observedAt.toISOString(), attempt: row.attempt,
    result: row.result as ProbeResult, confirmed: row.confirmed, reason: row.reason,
    statusCode: row.statusCode, durationMs: row.durationMs, finalUrl: row.finalUrl }))
  // The Site URL can change before the monitor retargets. The new URL stays
  // unknown. An open incident remains open until that retarget supersedes it.
  return uptimeHistorySchema.parse({ ...projectUptimeStatus(monitor.project, monitor, now), openIncidentCount,
    segments: uptimeTimeline(samples.map(row => ({ ...row, result: row.result as ProbeResult, scheduledAt: row.scheduledAt.toISOString(), observedAt: row.observedAt.toISOString() })), now, window),
    window, probes, incidents: incidents.map(row => ({ id: row.id, targetUrl: row.targetUrl, reason: row.reason,
      startedAt: row.startedAt.toISOString(), confirmedAt: row.confirmedAt.toISOString(), recoveredAt: row.recoveredAt?.toISOString() ?? null, supersededAt: row.supersededAt?.toISOString() ?? null })),
    nextCursor: rows.length > 100 ? probes.at(-1)!.id : null })
}

export function loadUptimeHistory(projectId: string, window: UptimeHistory['window'] = '24h', cursor: string | null = null, now = new Date()): Promise<UptimeHistory | null> {
  return readUptime(projectId, window, cursor, now, true)
}

export async function loadUptimeSummary(projectId: string, now = new Date()): Promise<UptimeSummary | null> {
  const projection = await readUptime(projectId, '24h', null, now, false)
  return projection ? uptimeSummarySchema.parse(projection) : null
}

export async function loadUptimeEvents(projectId: string) {
  const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId }, select: { id: true } })
  return monitor ? prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id }, orderBy: { confirmedAt: 'desc' }, take: 50,
    select: { id: true, targetUrl: true, startedAt: true, confirmedAt: true, recoveredAt: true, supersededAt: true, reason: true } }) : []
}
