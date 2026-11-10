import { uptimeReadSite } from './__tests__/read-site'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ authorize: vi.fn(), monitor: vi.fn(), project: vi.fn(), periods: vi.fn(), probes: vi.fn(), incidents: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: db.periods, uptimeMonitor: { findUnique: db.monitor }, project: { findUnique: db.project, findFirst: db.authorize },
  uptimeProbe: { findMany: db.probes }, uptimeIncident: { findMany: db.incidents } } }))
import { loadUptimeEvents, loadUptimeHistory, loadUptimeSummary, loadUptimeStatus } from './queries'
import { uptimeSummarySchema } from './contracts'
const project = { id: 'owned-project', userId: 'owner', url: 'https://example.com/', deletedAt: null, watchInterval: 'WEEKLY', watchNextRunAt: new Date('2026-10-20T12:00:00Z'),
  user: { id: 'owner', role: 'admin', plan: 'FREE', subscriptionStatus: null, lifecycleStatus: 'ACTIVE' } }
beforeEach(() => {
  vi.clearAllMocks()
  db.authorize.mockResolvedValue({ id: project.id })
  db.monitor.mockResolvedValue(null); db.project.mockResolvedValue(project)
  db.periods.mockResolvedValue([]); db.probes.mockResolvedValue([]); db.incidents.mockResolvedValue([])
})
describe('Uptime before the first recorded observation', () => {
  it('shows truthful gaps without creating a monitor or probe on read', async () => {
    const history = await loadUptimeHistory(uptimeReadSite(project))
    expect(history).toMatchObject({ enabled: true, state: 'unknown', lastCheckedAt: null, probes: [], incidents: [] })
    expect(history!.segments).toHaveLength(48)
    expect(history!.segments.every(segment => segment.state === 'unknown' && segment.checked === 0)).toBe(true)
  })
  it('keeps an unsafe target unknown while monitoring is requested', async () => {
    db.project.mockResolvedValue({ ...project, url: 'http://127.0.0.1/' })
    expect(await loadUptimeHistory(uptimeReadSite(project))).toMatchObject({ enabled: true, state: 'unknown', probes: [] })
  })
  it('distinguishes a paused schedule from missing evidence', async () => {
    db.project.mockResolvedValue({ ...project, watchInterval: null, watchNextRunAt: null })
    expect(await loadUptimeHistory(uptimeReadSite(project))).toMatchObject({ enabled: false, state: 'paused' })
  })
  it('keeps included uptime enabled when the analysis cadence has no next run', async () => {
    db.project.mockResolvedValue({ ...project, watchInterval: 'DAILY', watchNextRunAt: null,
      user: { ...project.user, role: 'user', plan: 'FREE' } })
    expect(await loadUptimeHistory(uptimeReadSite(project))).toMatchObject({ enabled: true, state: 'unknown', nextCheckAt: null })
  })
  it('withholds private monitoring data from a suspended owner before a monitor exists', async () => {
    db.project.mockResolvedValue({ ...project, user: { ...project.user, lifecycleStatus: 'SUSPENDED' } })
    db.authorize.mockResolvedValue(null)
    await expect(loadUptimeHistory(uptimeReadSite(project))).rejects.toMatchObject({ status: 404 })
    expect(db.monitor).not.toHaveBeenCalled()
    expect(db.periods).not.toHaveBeenCalled()
  })
})

describe('Uptime summary reads', () => {
  it('reads the same current status without loading probe history, timeline samples or incident counts', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    const monitor = { version: 1, targetUrl: project.url, enabled: true, state: 'offline', lastCheckedAt: now,
      nextProbeAt: now, confirmationDueAt: null, incidents: [{ version: 1, targetUrl: project.url, confirmedAt: now }] }
    db.project.mockResolvedValue({ ...project, uptimeMonitor: monitor })
    expect(await loadUptimeStatus(uptimeReadSite(project), now)).toMatchObject({ enabled: true, state: 'offline', incidentOpen: true })
    expect(db.monitor).not.toHaveBeenCalled()
    expect(db.probes).not.toHaveBeenCalled()
    expect(db.incidents).not.toHaveBeenCalled()
  })
  it('withholds earlier observations from a suspended owner', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    db.monitor.mockResolvedValue({ id: 'monitor_1', version: 1, targetUrl: project.url,
      project: { ...project, user: { ...project.user, lifecycleStatus: 'SUSPENDED' } },
      enabled: true, state: 'online', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000), confirmationDueAt: null, incidents: [] })
    db.authorize.mockResolvedValue(null)
    await expect(loadUptimeSummary(uptimeReadSite(project), now)).rejects.toMatchObject({ status: 404 })
  })
  it('uses the same facts as history without loading detailed probes or incidents', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    db.monitor.mockResolvedValue({ id: 'monitor_1', version: 1, targetUrl: project.url, project,
      enabled: true, state: 'online', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000), confirmationDueAt: null, incidents: [] })
    const startAt = new Date(now.getTime() - 30 * 60_000)
    db.periods.mockResolvedValue([{ startAt, checked: 3, allOnline: true, failed: false }])
    db.probes.mockResolvedValue([{ id: 'probe_1', targetUrl: project.url, scheduledAt: startAt, observedAt: startAt,
      attempt: 1, result: 'ONLINE', confirmed: false, reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: project.url }])
    const summary = await loadUptimeSummary(uptimeReadSite(project), now)
    expect(summary).toMatchObject({ enabled: true, state: 'online', lastCheckedAt: now.toISOString(), openIncidentCount: 0 })
    expect(summary?.segments.at(-1)).toMatchObject({ state: 'online', checked: 3, expected: 3 })
    expect(db.periods).toHaveBeenCalledOnce()
    expect(db.probes).not.toHaveBeenCalled()
    expect(db.incidents).not.toHaveBeenCalled()
    const history = await loadUptimeHistory(uptimeReadSite(project), '24h', null, now)
    expect(summary).toEqual(uptimeSummarySchema.parse(history))
    expect(history!.historyScope).toEqual({ key: 'monitor_1:1', from: '2026-10-12T12:00:00.000Z', through: now.toISOString() })
    expect(history!.probes).toHaveLength(1)
    expect(db.probes).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ take: 101 }))
    expect(db.incidents).toHaveBeenCalledOnce()
  })
  it('keeps an open incident visible when the Site URL has not yet retargeted the monitor', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    const previous = 'https://previous.example/'
    db.monitor.mockResolvedValue({ id: 'monitor_1', version: 1, targetUrl: previous, project,
      enabled: true, state: 'offline', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000), confirmationDueAt: null,
      incidents: [{ version: 1, targetUrl: previous, confirmedAt: now }] })
    db.incidents.mockResolvedValue([{ id: 'incident_1', targetUrl: previous, reason: 'response_error',
      startedAt: now, confirmedAt: now, recoveredAt: null, supersededAt: null }])
    const summary = await loadUptimeSummary(uptimeReadSite(project), now)
    expect(summary).toMatchObject({ enabled: true, targetUrl: project.url, state: 'unknown', lastCheckedAt: null, nextCheckAt: null, openIncidentCount: 1 })
    const history = await loadUptimeHistory(uptimeReadSite(project), '24h', null, now)
    expect(history).toMatchObject({ openIncidentCount: 1, state: 'unknown', targetUrl: project.url })
    expect(history!.incidents).toEqual([expect.objectContaining({ id: 'incident_1', targetUrl: previous, recoveredAt: null, supersededAt: null })])
    expect(db.periods).not.toHaveBeenCalled()
    expect(db.probes).not.toHaveBeenCalled()
  })
})

it('does not expand provisional possession into project uptime evidence', async () => {
  const site = { kind: 'provisional' as const, projectId: project.id, userId: project.userId }
  expect(await loadUptimeHistory(site)).toBeNull()
  expect(await loadUptimeSummary(site)).toBeNull()
  expect(await loadUptimeEvents(site)).toEqual([])
  expect(await loadUptimeStatus(site)).toBeNull()
  expect(db.monitor).not.toHaveBeenCalled()
})
