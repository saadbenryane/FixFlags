import { z } from 'zod'
import { prisma } from '@/lib/db'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { currentUptimeState, uptimeTimeline, type ProbeResult, type UptimeHistory, type UptimeProbeView, type UptimeState, type UptimeSummary } from './domain'
import { uptimeEligible, uptimeProjectInclude } from './eligibility'
import { uptimeHistorySchema, uptimeSummarySchema } from './contracts'

function windowStart(window: UptimeHistory['window'], now: Date) {
  return new Date(now.getTime() - (window === '24h' ? 1 : window === '7d' ? 7 : 30) * 86400_000)
}
const projectionInclude = { project: { include: uptimeProjectInclude } } as const

async function readUptime(projectId: string, window: UptimeHistory['window'], cursor: string | null, now: Date, includeHistory: boolean): Promise<UptimeHistory | null> {
  const monitor = await prisma.uptimeMonitor.findUnique({ where: { projectId }, include: projectionInclude })
  if (!monitor) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, include: uptimeProjectInclude })
    if (!project || project.deletedAt) return null
    if (cursor) throw new Error('Invalid uptime cursor')
    const target = normalizeAuditUrl(project.url)
    const enabled = uptimeEligible(project)
    return { enabled, targetUrl: target.ok ? target.url : project.url, state: enabled ? 'unknown' : 'paused',
      lastCheckedAt: null, nextCheckAt: null, openIncidentCount: 0, segments: uptimeTimeline([], now, window),
      window, probes: [], incidents: [], nextCursor: null }
  }
  if (monitor.project.deletedAt) return null
  const target = normalizeAuditUrl(monitor.project.url)
  const targetMatches = target.ok && target.url === monitor.targetUrl
  const from = windowStart(window, now)
  const scope = { monitorId: monitor.id, version: monitor.version, targetUrl: target.ok ? target.url : '', observedAt: { gte: from, lte: now } }
  let before: { observedAt: Date; id: string } | null = null
  if (cursor) {
    const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).parse(cursor)
    before = await prisma.uptimeProbe.findFirst({ where: { ...scope, id }, select: { id: true, observedAt: true } })
    if (!before) throw new Error('Invalid uptime cursor')
  }
  const [samples, rows, incidents, openIncidentCount] = await Promise.all([
    prisma.uptimeProbe.findMany({ where: scope, select: { scheduledAt: true, observedAt: true, attempt: true, result: true, confirmed: true }, take: 18_000, orderBy: { observedAt: 'desc' } }),
    includeHistory ? prisma.uptimeProbe.findMany({ where: { ...scope, ...(before ? { OR: [{ observedAt: { lt: before.observedAt, gte: from } }, { observedAt: before.observedAt, id: { lt: before.id } }] } : {}) },
      orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], take: 101 }) : [],
    includeHistory ? prisma.uptimeIncident.findMany({ where: { monitorId: monitor.id, startedAt: { lte: now }, OR: [{ confirmedAt: { gte: from } }, { recoveredAt: null, supersededAt: null }, { recoveredAt: { gte: from } }] },
      orderBy: { confirmedAt: 'desc' }, take: 100 }) : [],
    prisma.uptimeIncident.count({ where: { monitorId: monitor.id, version: monitor.version, recoveredAt: null, supersededAt: null } }),
  ])
  const enabled = uptimeEligible(monitor.project)
  const state = currentUptimeState({ enabled, state: monitor.enabled && targetMatches ? monitor.state as UptimeState : 'unknown', lastCheckedAt: targetMatches ? monitor.lastCheckedAt : null, now })
  const probes: UptimeProbeView[] = rows.slice(0, 100).map(row => ({ id: row.id, targetUrl: row.targetUrl,
    scheduledAt: row.scheduledAt.toISOString(), observedAt: row.observedAt.toISOString(), attempt: row.attempt,
    result: row.result as ProbeResult, confirmed: row.confirmed, reason: row.reason,
    statusCode: row.statusCode, durationMs: row.durationMs, finalUrl: row.finalUrl }))
  return uptimeHistorySchema.parse({ enabled, targetUrl: target.ok ? target.url : monitor.project.url, state, lastCheckedAt: targetMatches ? monitor.lastCheckedAt?.toISOString() ?? null : null,
    nextCheckAt: enabled && targetMatches ? (monitor.confirmationDueAt ?? monitor.nextProbeAt).toISOString() : null, openIncidentCount: targetMatches ? openIncidentCount : 0,
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
