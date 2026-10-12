import { deleteExpiredAccountMessages } from '@/lib/sites/accounts/retention'
import { tryAcquireLock, withSchedulerLease } from './lock'
import {
  recoverCompletedImprovementProjections,
  runStuckAuditRecoverySweep,
} from '@/lib/audit/recover-audit-job'
import { runNurtureSweep } from '@/lib/leads/run-nurture'
import { processDueProjectWatches, retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import { processIntegrityMaintenance } from '@/lib/integrity/watch'
import { runIssueRollup } from '@/lib/growth/issue-rollup'
import { runGscPull } from '@/lib/growth/gsc-pull'
import { runGaPull } from '@/lib/growth/ga-pull'
import { deleteExpiredProductSignals } from '@/lib/signals/product-signals'
import { logger } from '@/lib/logger'
import { createTimerScheduler } from './timer-scheduler'
import { recoverExpiredSiteRuns } from '@/lib/sites/application/run-leases'
import { reconcileOutcomeRunsForAudit } from '@/lib/sites/application/run-requests'
import { dispatchPendingAudits } from '@/lib/audit/dispatch'
import { recoverProgressiveAudits } from '@/lib/audit/progressive/runtime'

const PROGRESSIVE_RECOVERY_INTERVAL_MS = 10_000
const RECOVERY_INTERVAL_MS = 120_000
const RECOVERY_LOCK_TTL_MS = 110_000

const WATCH_INTERVAL_MS = 5 * 60_000 // every 5 min
const WATCH_LOCK_TTL_MS = 4 * 60_000

const NURTURE_INTERVAL_MS = 6 * 60 * 60 * 1000 // check every 6h
const NURTURE_LOCK_TTL_MS = 23 * 60 * 60 * 1000 // ...but only actually run ~once/day

const ROLLUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // check every 6h
const ROLLUP_LOCK_TTL_MS = 23 * 60 * 60 * 1000 // ...but only actually run ~once/day (nightly)

const ANALYTICS_INTERVAL_MS = 24 * 60 * 60 * 1000 // check every 24h
const ANALYTICS_LOCK_TTL_MS = 25 * 60 * 60 * 1000 // ...but only actually run ~once/day

const SIGNAL_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000
const SIGNAL_RETENTION_LOCK_TTL_MS = 25 * 60 * 60 * 1000

let scheduler: ReturnType<typeof createTimerScheduler> | null = null
let progressiveRecoveryRunning = false

async function progressiveRecoveryTick(): Promise<void> {
  if (progressiveRecoveryRunning) return
  progressiveRecoveryRunning = true
  try {
    await withSchedulerLease('progressive-recovery', async signal => {
      await dispatchPendingAudits()
      if (!signal.aborted) await recoverProgressiveAudits()
    })
  } catch (error) { logger.error('Progressive recovery sweep failed', error instanceof Error ? error : new Error(String(error))) }
  finally { progressiveRecoveryRunning = false }
}

async function recoveryTick(): Promise<void> {
  if (!(await tryAcquireLock('recover-stuck-audits', RECOVERY_LOCK_TTL_MS))) return
  try {
    const result = await runStuckAuditRecoverySweep()
    if (result.requeued || result.failed) logger.info('Recovery sweep', result)
    const projections = await recoverCompletedImprovementProjections()
    if (projections.checked > 0) logger.info('Improvement projection recovery sweep', projections)
    const runs = await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)
    if (runs > 0) logger.info('Recovered abandoned Site executions', { runs })
  } catch (err) {
    logger.error('Recovery sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function integrityWatchTick(): Promise<void> {
  if (!(await tryAcquireLock('integrity-watches', WATCH_LOCK_TTL_MS))) return
  try {
    const result = await processIntegrityMaintenance()
    if (result.walks > 0 || result.pulseWalks > 0) logger.info('Integrity maintenance', result)
  } catch (err) {
    logger.error('Integrity watch sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function projectWatchTick(): Promise<void> {
  if (!(await tryAcquireLock('project-watches', WATCH_LOCK_TTL_MS))) return
  try {
    const result = await processDueProjectWatches()
    const notificationRetries = await retryPendingWatchNotifications()
    if (result.processed > 0) logger.info('Project watch sweep', result)
    if (notificationRetries > 0) logger.info('Project watch notification retries', { notificationRetries })
  } catch (err) {
    logger.error('Project watch sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function nurtureTick(): Promise<void> {
  if (!(await tryAcquireLock('nurture-emails', NURTURE_LOCK_TTL_MS))) return
  try {
    const result = await runNurtureSweep()
    logger.info('Nurture sweep', result)
  } catch (err) {
    logger.error('Nurture sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function growthRollupTick(): Promise<void> {
  if (!(await tryAcquireLock('growth-rollup-issues', ROLLUP_LOCK_TTL_MS))) return
  try {
    const result = await runIssueRollup()
    logger.info('Growth issue rollup', result)
  } catch (err) {
    logger.error('Growth issue rollup failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function analyticsTick(): Promise<void> {
  if (!(await tryAcquireLock('growth-analytics', ANALYTICS_LOCK_TTL_MS))) return
  try {
    await runGscPull()
    await runGaPull()
    logger.info('Growth analytics pull completed')
  } catch (err) {
    logger.error('Growth analytics pull failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function signalRetentionTick(): Promise<void> {
  if (!(await tryAcquireLock('product-signal-retention', SIGNAL_RETENTION_LOCK_TTL_MS))) return
  try {
    const deleted = await deleteExpiredProductSignals()
    if (deleted > 0) logger.info('Expired Product Signals deleted', { deleted })
  } catch (err) {
    logger.error(
      'Product Signal retention failed',
      err instanceof Error ? err : new Error(String(err))
    )
  }
}

export async function accountRetentionTick(): Promise<void> {
  try {
    await withSchedulerLease('account-message-retention', async signal => {
      if (!signal.aborted) await deleteExpiredAccountMessages()
    })
  } catch (error) { logger.error('Account verification retention failed', error instanceof Error ? error : new Error(String(error))) }
}

/**
 * Self-hosted scheduler for periodic jobs (stuck-audit recovery + nurture
 * emails + knowledge-graph issue rollup). Runs in every dedicated worker; a
 * Redis lock ensures exactly one instance runs each job per window, so it
 * scales safely to any number of workers and needs no external cron.
 * Idempotent; timers are unref'd so they never keep the process alive.
 */
export function startRecoveryScheduler() {
  if (scheduler && !scheduler.isStopped()) return scheduler
  scheduler = createTimerScheduler(error => logger.error('Scheduler callback failed', error))
  const jobs: Array<[() => Promise<unknown>, number, number]> = [
    [accountRetentionTick, 5000, 60_000],
    [progressiveRecoveryTick, 1000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [recoveryTick, 15_000, RECOVERY_INTERVAL_MS],
    [projectWatchTick, 45_000, WATCH_INTERVAL_MS],
    [integrityWatchTick, 50_000, WATCH_INTERVAL_MS],
    [nurtureTick, 60_000, NURTURE_INTERVAL_MS],
    [growthRollupTick, 90_000, ROLLUP_INTERVAL_MS],
    [analyticsTick, 120_000, ANALYTICS_INTERVAL_MS],
    [signalRetentionTick, 150_000, SIGNAL_RETENTION_INTERVAL_MS],
  ]
  for (const [tick, initial, interval] of jobs) {
    scheduler.schedule(tick, initial)
    scheduler.schedule(tick, interval, true)
  }
  logger.info('Recovery scheduler started')
  return scheduler
}
