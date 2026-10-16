import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ monitor: vi.fn(), project: vi.fn(), probes: vi.fn(), incidents: vi.fn(), incidentCount: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { uptimeMonitor: { findUnique: db.monitor }, project: { findUnique: db.project },
  uptimeProbe: { findMany: db.probes }, uptimeIncident: { findMany: db.incidents, count: db.incidentCount } } }))
import { loadUptimeHistory, loadUptimeSummary } from './queries'
import { uptimeSummarySchema } from './contracts'
const project = { id: 'owned-project', url: 'https://example.com/', deletedAt: null, watchInterval: 'WEEKLY', watchNextRunAt: new Date('2026-10-20T12:00:00Z'),
  user: { id: 'owner', role: 'admin', plan: 'FREE', subscriptionStatus: null, lifecycleStatus: 'ACTIVE' } }
beforeEach(() => {
  vi.clearAllMocks()
  db.monitor.mockResolvedValue(null); db.project.mockResolvedValue(project)
  db.probes.mockResolvedValue([]); db.incidents.mockResolvedValue([]); db.incidentCount.mockResolvedValue(0)
})
describe('Uptime before the first recorded observation', () => {
  it('shows truthful gaps without creating a monitor or probe on read', async () => {
    const history = await loadUptimeHistory(project.id)
    expect(history).toMatchObject({ enabled: true, state: 'unknown', lastCheckedAt: null, probes: [], incidents: [] })
    expect(history!.segments).toHaveLength(48)
    expect(history!.segments.every(segment => segment.state === 'unknown' && segment.checked === 0)).toBe(true)
  })
  it('keeps an unsafe target unknown while monitoring is requested', async () => {
    db.project.mockResolvedValue({ ...project, url: 'http://127.0.0.1/' })
    expect(await loadUptimeHistory(project.id)).toMatchObject({ enabled: true, state: 'unknown', probes: [] })
  })
  it('distinguishes a paused schedule from missing evidence', async () => {
    db.project.mockResolvedValue({ ...project, watchInterval: null, watchNextRunAt: null })
    expect(await loadUptimeHistory(project.id)).toMatchObject({ enabled: false, state: 'paused' })
  })
  it('keeps included uptime enabled when the analysis cadence has no next run', async () => {
    db.project.mockResolvedValue({ ...project, watchInterval: 'DAILY', watchNextRunAt: null,
      user: { ...project.user, role: 'user', plan: 'FREE' } })
    expect(await loadUptimeHistory(project.id)).toMatchObject({ enabled: true, state: 'unknown', nextCheckAt: null })
  })
  it('shows suspended accounts as paused before a monitor exists', async () => {
    db.project.mockResolvedValue({ ...project, user: { ...project.user, lifecycleStatus: 'SUSPENDED' } })
    expect(await loadUptimeHistory(project.id)).toMatchObject({ enabled: false, state: 'paused', nextCheckAt: null })
  })
})

describe('Uptime summary reads', () => {
  it('retains an earlier observation without reporting active monitoring for a suspended account', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    db.monitor.mockResolvedValue({ id: 'monitor_1', version: 1, targetUrl: project.url,
      project: { ...project, user: { ...project.user, lifecycleStatus: 'SUSPENDED' } },
      enabled: true, state: 'online', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000), confirmationDueAt: null })
    expect(await loadUptimeSummary(project.id, now)).toMatchObject({ enabled: false, state: 'paused',
      nextCheckAt: null, lastCheckedAt: now.toISOString() })
  })
  it('uses the same facts as history without loading detailed probes or incidents', async () => {
    const now = new Date('2026-10-13T12:00:00Z')
    db.monitor.mockResolvedValue({ id: 'monitor_1', version: 1, targetUrl: project.url, project,
      enabled: true, state: 'online', lastCheckedAt: now, nextProbeAt: new Date(now.getTime() + 300_000), confirmationDueAt: null })
    db.probes.mockResolvedValue([{ id: 'probe_1', targetUrl: project.url, scheduledAt: now, observedAt: now,
      attempt: 1, result: 'ONLINE', confirmed: false, reason: 'response_received', statusCode: 200, durationMs: 50, finalUrl: project.url }])
    const summary = await loadUptimeSummary(project.id, now)
    expect(summary).toMatchObject({ enabled: true, state: 'online', lastCheckedAt: now.toISOString(), openIncidentCount: 0 })
    expect(db.probes).toHaveBeenCalledOnce()
    expect(db.probes).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ result: true, confirmed: true }) }))
    expect(db.incidents).not.toHaveBeenCalled()
    const history = await loadUptimeHistory(project.id, '24h', null, now)
    expect(summary).toEqual(uptimeSummarySchema.parse(history))
    expect(history!.probes).toHaveLength(1)
    expect(db.incidents).toHaveBeenCalledOnce()
  })
})
