import { tryAcquireLock } from './lock'
import { runStuckAuditRecoverySweep } from '@/lib/audit/recover-audit-job'
import { runNurtureSweep } from '@/lib/leads/run-nurture'
import { processDueProjectWatches, retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import { runIssueRollup } from '@/lib/growth/issue-rollup'
import { runGscPull } from '@/lib/growth/gsc-pull'
import { runGaPull } from '@/lib/growth/ga-pull'
import { logger } from '@/lib/logger'

const RECOVERY_INTERVAL_MS = 120_000 // ~2 min
const RECOVERY_LOCK_TTL_MS = 110_000 // < interval so it re-acquires next tick

const WATCH_INTERVAL_MS = 5 * 60_000 // every 5 min
const WATCH_LOCK_TTL_MS = 4 * 60_000

const NURTURE_INTERVAL_MS = 6 * 60 * 60 * 1000 // check every 6h
const NURTURE_LOCK_TTL_MS = 23 * 60 * 60 * 1000 // ...but only actually run ~once/day

const ROLLUP_INTERVAL_MS = 6 * 60 * 60 * 1000 // check every 6h
const ROLLUP_LOCK_TTL_MS = 23 * 60 * 60 * 1000 // ...but only actually run ~once/day (nightly)

const ANALYTICS_INTERVAL_MS = 24 * 60 * 60 * 1000 // check every 24h
const ANALYTICS_LOCK_TTL_MS = 25 * 60 * 60 * 1000 // ...but only actually run ~once/day

let started = false

async function recoveryTick(): Promise<void> {
  if (!(await tryAcquireLock('recover-stuck-audits', RECOVERY_LOCK_TTL_MS))) return
  try {
    const result = await runStuckAuditRecoverySweep()
    if (result.requeued || result.failed) logger.info('Recovery sweep', result)
  } catch (err) {
    logger.error('Recovery sweep failed', err instanceof Error ? err : new Error(String(err)))
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

/**
 * Self-hosted scheduler for periodic jobs (stuck-audit recovery + nurture
 * emails + knowledge-graph issue rollup). Runs in every dedicated worker; a
 * Redis lock ensures exactly one instance runs each job per window, so it
 * scales safely to any number of workers and needs no external cron.
 * Idempotent; timers are unref'd so they never keep the process alive.
 */
export function startRecoveryScheduler(): void {
  if (started) return
  started = true

  const initialRecovery = setTimeout(() => void recoveryTick(), 15_000)
  initialRecovery.unref?.()
  const recoveryTimer = setInterval(() => void recoveryTick(), RECOVERY_INTERVAL_MS)
  recoveryTimer.unref?.()

  const initialWatch = setTimeout(() => void projectWatchTick(), 45_000)
  initialWatch.unref?.()
  const watchTimer = setInterval(() => void projectWatchTick(), WATCH_INTERVAL_MS)
  watchTimer.unref?.()

  const initialNurture = setTimeout(() => void nurtureTick(), 60_000)
  initialNurture.unref?.()
  const nurtureTimer = setInterval(() => void nurtureTick(), NURTURE_INTERVAL_MS)
  nurtureTimer.unref?.()

  const initialRollup = setTimeout(() => void growthRollupTick(), 90_000)
  initialRollup.unref?.()
  const rollupTimer = setInterval(() => void growthRollupTick(), ROLLUP_INTERVAL_MS)
  rollupTimer.unref?.()

  const initialAnalytics = setTimeout(() => void analyticsTick(), 120_000)
  initialAnalytics.unref?.()
  const analyticsTimer = setInterval(() => void analyticsTick(), ANALYTICS_INTERVAL_MS)
  analyticsTimer.unref?.()

  logger.info('Recovery scheduler started')
}
