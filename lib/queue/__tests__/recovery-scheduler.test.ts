import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ watches: vi.fn(), notifications: vi.fn(), contexts: vi.fn(), lock: vi.fn(), dispatch: vi.fn(), progressive: vi.fn(),
  stuck: vi.fn(), projections: vi.fn(), runs: vi.fn() }))
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: mocks.lock,
  withSchedulerLease: async (_name: string, task: (signal: AbortSignal) => Promise<void>) => task(new AbortController().signal) }))
vi.mock('@/lib/audit/project-watch', () => ({ processDueProjectWatches: mocks.watches, retryPendingWatchNotifications: mocks.notifications }))
vi.mock('@/lib/sites/connections/google', () => ({ refreshDueGoogleContexts: mocks.contexts }))
vi.mock('@/lib/sites/accounts/retention', () => ({ deleteExpiredAccountMessages: async () => 0 }))
vi.mock('@/lib/audit/recover-audit-job', () => ({ recoverCompletedImprovementProjections: mocks.projections, runStuckAuditRecoverySweep: mocks.stuck }))
vi.mock('@/lib/leads/run-nurture', () => ({ runNurtureSweep: async () => ({}) }))
vi.mock('@/lib/integrity/watch', () => ({ processIntegrityMaintenance: async () => ({ walks: 0, pulseWalks: 0 }) }))
vi.mock('@/lib/growth/issue-rollup', () => ({ runIssueRollup: async () => ({}) }))
vi.mock('@/lib/growth/gsc-pull', () => ({ runGscPull: async () => {} }))
vi.mock('@/lib/growth/ga-pull', () => ({ runGaPull: async () => {} }))
vi.mock('@/lib/signals/product-signals', () => ({ deleteExpiredProductSignals: async () => 0 }))
vi.mock('@/lib/sites/application/run-leases', () => ({ recoverExpiredSiteRuns: mocks.runs }))
vi.mock('@/lib/sites/application/run-requests', () => ({ reconcileOutcomeRunsForAudit: async () => {} }))
vi.mock('@/lib/audit/dispatch', () => ({ dispatchPendingAudits: mocks.dispatch }))
vi.mock('@/lib/audit/progressive/runtime', () => ({ recoverProgressiveAudits: mocks.progressive }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn() } }))
import { startRecoveryScheduler } from '../recovery-scheduler'

beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks()
  mocks.lock.mockResolvedValue(true)
  mocks.watches.mockResolvedValue({ processed: 0, enqueued: 0, errors: 0 })
  mocks.notifications.mockResolvedValue(0)
  mocks.contexts.mockResolvedValue(undefined)
  mocks.dispatch.mockResolvedValue(0)
  mocks.progressive.mockResolvedValue(0)
  mocks.stuck.mockResolvedValue({ requeued: 0, failed: 0, checked: 0 })
  mocks.projections.mockResolvedValue({ projected: 0, failed: 0, checked: 0 })
  mocks.runs.mockResolvedValue(0)
})
afterEach(() => vi.useRealTimers())

describe('independent scheduled Site maintenance', () => {
  it('checks due notifications independently of global maintenance rate windows', async () => {
    mocks.lock.mockResolvedValue(false)
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(125_000)
      expect(mocks.notifications).toHaveBeenCalledTimes(5)
      expect(mocks.lock.mock.calls.some(([name]) => name === 'project-watch-notifications')).toBe(false)
    } finally { await scheduler.stop() }
  })
  it('checks due Sites in bounded passes independently of global maintenance rate windows', async () => {
    mocks.lock.mockResolvedValue(false)
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(125_000)
      expect(mocks.watches).toHaveBeenCalledTimes(5)
      expect(mocks.lock.mock.calls.some(([name]) => name === 'project-watches')).toBe(false)
    } finally { await scheduler.stop() }
  })

  it('keeps one slow Site admission pass from overlapping itself while independent maintenance continues', async () => {
    let finish!: (result: { processed: number; enqueued: number; errors: number }) => void
    mocks.watches.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(125_000)
      expect(mocks.watches).toHaveBeenCalledOnce()
      expect(mocks.notifications).toHaveBeenCalledTimes(5)
      expect(mocks.contexts).toHaveBeenCalledOnce()
      expect(mocks.runs).toHaveBeenCalledTimes(2)
    } finally { finish({ processed: 0, enqueued: 0, errors: 0 }); await scheduler.stop() }
  })

  it('uses separate distributed claim windows for independent recoveries', async () => {
    const claimed = new Set<string>()
    mocks.lock.mockImplementation(async (name: string) => {
      if (claimed.has(name)) return false
      claimed.add(name); return true
    })
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(30_000)
      expect(mocks.stuck).toHaveBeenCalledOnce()
      expect(mocks.projections).toHaveBeenCalledOnce()
      expect(mocks.runs).toHaveBeenCalledOnce()
      expect(claimed.size).toBe(3)
    } finally { await scheduler.stop() }
  })

  it('continues projection and Site run recovery after legacy recovery fails', async () => {
    mocks.stuck.mockRejectedValue(new Error('Legacy queue unavailable'))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(30_000)
      expect(mocks.projections).toHaveBeenCalledOnce()
      expect(mocks.runs).toHaveBeenCalledOnce()
    } finally { await scheduler.stop() }
  })

  it.each(['stuck', 'projections', 'runs'] as const)('keeps other recovery lanes moving while %s is slow', async lane => {
    let finish!: () => void
    mocks[lane].mockReturnValue(new Promise(resolve => { finish = () => resolve(lane === 'stuck' ? { requeued: 0, failed: 0, checked: 0 }
      : lane === 'projections' ? { projected: 0, failed: 0, checked: 0 } : 0) }))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(250_000)
      expect(mocks[lane]).toHaveBeenCalledOnce()
      for (const other of ['stuck', 'projections', 'runs'] as const) if (other !== lane)
        expect(mocks[other]).toHaveBeenCalledTimes(3)
    } finally { finish(); await scheduler.stop() }
  })

  it('recovers already admitted graphs even when the pending admission sweep fails', async () => {
    mocks.dispatch.mockRejectedValue(new Error('Pending admission query unavailable'))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(11_000)
      expect(mocks.dispatch).toHaveBeenCalledTimes(2)
      expect(mocks.progressive).toHaveBeenCalledTimes(2)
    } finally { await scheduler.stop() }
  })

  it('retries notifications even when Site admission fails', async () => {
    mocks.watches.mockRejectedValue(new Error('Admission unavailable'))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(60_000)
      expect(mocks.notifications).toHaveBeenCalledTimes(3)
      expect(mocks.contexts).toHaveBeenCalledOnce()
    } finally { await scheduler.stop() }
  })

  it('continues Site admission while notification delivery is slow without overlapping deliveries', async () => {
    let finish!: (count: number) => void
    mocks.notifications.mockReturnValue(new Promise<number>(resolve => { finish = resolve }))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(345_000)
      expect(mocks.watches).toHaveBeenCalledTimes(12)
      expect(mocks.notifications).toHaveBeenCalledOnce()
    } finally { finish(0); await scheduler.stop() }
  })

  it('continues Site admission and alerts while provider context refresh is slow', async () => {
    let finish!: () => void
    mocks.contexts.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(345_000)
      expect(mocks.contexts).toHaveBeenCalledOnce()
      expect(mocks.watches).toHaveBeenCalledTimes(12)
      expect(mocks.notifications).toHaveBeenCalledTimes(12)
    } finally { finish?.(); await scheduler.stop() }
  })
})
