import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ watches: vi.fn(), notifications: vi.fn(), contexts: vi.fn(), lock: vi.fn(), dispatch: vi.fn(), progressive: vi.fn() }))
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: mocks.lock,
  withSchedulerLease: async (_name: string, task: (signal: AbortSignal) => Promise<void>) => task(new AbortController().signal) }))
vi.mock('@/lib/audit/project-watch', () => ({ processDueProjectWatches: mocks.watches, retryPendingWatchNotifications: mocks.notifications }))
vi.mock('@/lib/sites/connections/google', () => ({ refreshDueGoogleContexts: mocks.contexts }))
vi.mock('@/lib/sites/accounts/retention', () => ({ deleteExpiredAccountMessages: async () => 0 }))
vi.mock('@/lib/audit/recover-audit-job', () => ({ recoverCompletedImprovementProjections: async () => ({ checked: 0 }), runStuckAuditRecoverySweep: async () => ({ requeued: 0, failed: 0 }) }))
vi.mock('@/lib/leads/run-nurture', () => ({ runNurtureSweep: async () => ({}) }))
vi.mock('@/lib/integrity/watch', () => ({ processIntegrityMaintenance: async () => ({ walks: 0, pulseWalks: 0 }) }))
vi.mock('@/lib/growth/issue-rollup', () => ({ runIssueRollup: async () => ({}) }))
vi.mock('@/lib/growth/gsc-pull', () => ({ runGscPull: async () => {} }))
vi.mock('@/lib/growth/ga-pull', () => ({ runGaPull: async () => {} }))
vi.mock('@/lib/signals/product-signals', () => ({ deleteExpiredProductSignals: async () => 0 }))
vi.mock('@/lib/sites/application/run-leases', () => ({ recoverExpiredSiteRuns: async () => 0 }))
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
})
afterEach(() => vi.useRealTimers())

describe('independent scheduled Site maintenance', () => {
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
      expect(mocks.notifications).toHaveBeenCalledOnce()
      expect(mocks.contexts).toHaveBeenCalledOnce()
    } finally { await scheduler.stop() }
  })

  it('continues Site admission while notification delivery is slow without overlapping deliveries', async () => {
    let finish!: (count: number) => void
    mocks.notifications.mockReturnValue(new Promise<number>(resolve => { finish = resolve }))
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(345_000)
      expect(mocks.watches).toHaveBeenCalledTimes(2)
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
      expect(mocks.watches).toHaveBeenCalledTimes(2)
      expect(mocks.notifications).toHaveBeenCalledTimes(2)
    } finally { finish?.(); await scheduler.stop() }
  })
})
