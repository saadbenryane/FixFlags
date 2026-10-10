import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ load: vi.fn(), user: vi.fn(), prior: vi.fn(), command: vi.fn(), run: vi.fn(), allowed: vi.fn(), page: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: m.user }, runRequest: { findFirst: m.prior }, siteOutcome: { findFirst: m.page } } }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: m.load }))
vi.mock('@/lib/auth/entitlements', () => ({ allowedWatchIntervals: m.allowed }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: m.command }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestOutcomeRun: m.run }))
import { activateSiteMonitoring } from '../monitoring-activation'
const input = { siteId: 'site-1', userId: 'owner', interval: 'weekly' as const }
const off = { siteId: 'site-1', projectId: 'project-1', userId: 'owner', watchInterval: null, watchNextRunAt: null }
const on = { ...off, watchInterval: 'weekly', watchNextRunAt: new Date('2026-10-17T09:00:00Z') }
describe('monitoring activation', () => {
  beforeEach(() => {
    vi.resetAllMocks(); m.load.mockResolvedValueOnce(off).mockResolvedValue(on); m.user.mockResolvedValue({ id: 'owner' }); m.allowed.mockReturnValue(['weekly']); m.prior.mockResolvedValue(null); m.page.mockResolvedValue(null)
    m.command.mockImplementation(async command => command.type === 'CONFIRM_PAGE_AVAILABILITY' ? { ok: true, outcome: { id: 'page-1' } } : { ok: true })
    m.run.mockResolvedValue({ runId: 'run-1', reused: false })
  })
  it('confirms coverage before scheduling and requests a scoped independent check', async () => {
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: true, interval: 'weekly', nextRunAt: '2026-10-17T09:00:00.000Z', firstCheck: 'requested' })
    expect(m.command.mock.calls.map(([value]) => value.type)).toEqual(['CONFIRM_PAGE_AVAILABILITY', 'SET_WATCH'])
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1', userId: 'owner', outcomeId: 'page-1', idempotencyKey: 'monitoring-start:page-1' }))
  })
  it('rejects another tenant before changing anything', async () => {
    m.load.mockReset().mockResolvedValue({ ...off, userId: 'someone-else' })
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: false })
    expect(m.command).not.toHaveBeenCalled(); expect(m.run).not.toHaveBeenCalled()
  })
  it('does not downgrade or silently substitute a forbidden cadence', async () => {
    expect(await activateSiteMonitoring({ ...input, interval: 'daily' })).toMatchObject({ ok: false, stage: 'schedule' })
    expect(m.command).not.toHaveBeenCalled()
  })
  it('never saves a schedule when coverage confirmation fails', async () => {
    m.command.mockResolvedValue({ ok: false })
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: false, stage: 'coverage' })
    expect(m.command).toHaveBeenCalledTimes(1); expect(m.run).not.toHaveBeenCalled()
  })
  it('retains coverage and reports a schedule failure without claiming activation', async () => {
    m.command.mockResolvedValueOnce({ ok: true, outcome: { id: 'page-1' } }).mockResolvedValueOnce({ ok: false })
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: false, stage: 'schedule' })
    expect(m.run).not.toHaveBeenCalled()
  })
  it('reports the persisted cadence rather than echoing the request', async () => {
    m.load.mockReset().mockResolvedValueOnce(off).mockResolvedValue({ ...on, watchInterval: 'daily' })
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: true, interval: 'daily' })
  })
  it('preserves an existing schedule and reuses the first check on repeated activation', async () => {
    m.load.mockReset().mockResolvedValue(on); m.page.mockResolvedValue({ id: 'page-1' })
    m.prior.mockResolvedValue({ id: 'run-1', status: 'COMPLETED', idempotencyKey: 'monitoring-start:page-1' }); m.run.mockResolvedValue({ reused: true })
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: true, reused: true })
    expect(m.command).not.toHaveBeenCalled()
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'monitoring-start:page-1' }))
  })
  it('keeps the saved schedule when the first check cannot start', async () => {
    m.run.mockRejectedValue(new Error('worker unavailable'))
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: true, interval: 'weekly', firstCheck: 'unavailable' })
  })
  it('makes a failed enqueue retryable using one deterministic new attempt', async () => {
    m.prior.mockResolvedValue({ id: 'failed-1', status: 'FAILED', idempotencyKey: 'monitoring-start:page-1' })
    await activateSiteMonitoring(input)
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'monitoring-start:page-1:retry:failed-1' }))
    expect(m.prior).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project-1', selections: { some: { outcomeId: 'page-1' } } }) }))
  })
  it('retries a crashed enqueue only after its lease expires', async () => {
    m.prior.mockResolvedValue({ id: 'interrupted-1', status: 'QUEUED', idempotencyKey: 'monitoring-start:page-1', auditId: null, leaseUntil: new Date(0) })
    await activateSiteMonitoring(input)
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'monitoring-start:page-1:retry:interrupted-1' }))
  })
  it('does not duplicate an enqueue that still has a live lease', async () => {
    m.prior.mockResolvedValue({ id: 'active-1', status: 'QUEUED', idempotencyKey: 'monitoring-start:page-1', auditId: null, leaseUntil: new Date(Date.now() + 60000) })
    await activateSiteMonitoring(input)
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'monitoring-start:page-1' }))
  })

  it('requests a fresh check when the customer restarts paused monitoring', async () => {
    m.prior.mockResolvedValue({ id: 'completed-1', status: 'COMPLETED', idempotencyKey: 'monitoring-start:page-1' })
    await activateSiteMonitoring(input)
    expect(m.run).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'monitoring-start:page-1:resume:completed-1' }))
  })

  it('recognizes an already queued Watch that includes this page and other coverage', async () => {
    m.prior.mockResolvedValueOnce(null).mockResolvedValue({ id: 'watch-batch' })
    m.run.mockRejectedValue(new Error('another scope is active'))
    expect(await activateSiteMonitoring(input)).toMatchObject({ ok: true, firstCheck: 'requested', reused: true })
    expect(m.prior).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ projectId: 'project-1', auditId: { not: null }, selections: { some: { outcomeId: 'page-1' } } }) }))
  })

})
