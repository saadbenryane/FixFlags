import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ monitor: vi.fn(), project: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { uptimeMonitor: { findUnique: db.monitor }, project: { findUnique: db.project } } }))
import { loadUptimeHistory } from './queries'
const project = { id: 'owned-project', url: 'https://example.com/', deletedAt: null, watchInterval: 'WEEKLY', watchNextRunAt: new Date('2026-10-20T12:00:00Z'),
  user: { id: 'owner', role: 'admin', plan: 'FREE', subscriptionStatus: null } }
beforeEach(() => { db.monitor.mockResolvedValue(null); db.project.mockResolvedValue(project) })
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
    db.project.mockResolvedValue({ ...project, watchNextRunAt: null })
    expect(await loadUptimeHistory(project.id)).toMatchObject({ enabled: false, state: 'paused' })
  })
})
