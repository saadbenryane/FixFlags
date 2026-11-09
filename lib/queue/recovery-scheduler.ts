import { deleteExpiredAccountMessages } from '@/lib/sites/accounts/retention'
import { deleteExpiredProviderWindows } from '@/lib/billing/provider-budget'
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
import { isAuditTaskTransportReady } from './client'
import { recoverExpiredSiteRuns } from '@/lib/sites/application/run-leases'
import { reconcileOutcomeRunsForAudit } from '@/lib/sites/application/run-requests'
import { dispatchPendingAudits } from '@/lib/audit/dispatch'
import { recoverPendingCoordinators } from '@/lib/audit/progressive/runtime'
import { recoverActiveTaskGraphs } from '@/lib/audit/progressive/engine'
import { recoverPendingAiReviews } from '@/lib/audit/enqueue-ai-review'
import { retireObsoleteTaskDeliveries } from '@/lib/audit/progressive/delivery-window'
import { refreshDueGoogleContexts } from '@/lib/sites/connections/google'
import { MONITORING_SWEEP_INTERVAL_MS } from '@/lib/sites/monitoring-freshness'
import { initializeDefaultMonitoring } from '@/lib/sites/application/default-monitoring'
import { deliverWebsiteSummaries } from '@/lib/notifications/service'
import { maintainEmailDelivery, retryPendingNurtureEmails } from '@/lib/email/maintenance'

const PROGRESSIVE_RECOVERY_INTERVAL_MS = 10_000
const RECOVERY_INTERVAL_MS = 120_000
const RECOVERY_LOCK_TTL_MS = 110_000

const WATCH_MAINTENANCE_INTERVAL_MS = 5 * 60_000
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

function leasedRecovery(name: string, recover: (signal: AbortSignal) => Promise<unknown>) {
  return async () => {
    try { await withSchedulerLease(name, async signal => { if (!signal.aborted) await recover(signal) }) }
    catch (error) { logger.error('Recovery sweep failed', error, { name }) }
  }
}

async function recoveryTick(): Promise<void> {
  if (!(await tryAcquireLock('recover-stuck-audits', RECOVERY_LOCK_TTL_MS))) return
  try {
    const result = await runStuckAuditRecoverySweep()
    if (result.requeued || result.failed) logger.info('Recovery sweep', result)
  } catch (err) {
    logger.error('Recovery sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function projectionRecoveryTick(): Promise<void> {
  if (!(await tryAcquireLock('recover-completed-projections', RECOVERY_LOCK_TTL_MS))) return
  try {
    const projections = await recoverCompletedImprovementProjections()
    if (projections.checked > 0) logger.info('Improvement projection recovery sweep', projections)
  } catch (err) {
    logger.error('Improvement projection recovery sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function siteRunRecoveryTick(): Promise<void> {
  if (!(await tryAcquireLock('recover-expired-site-runs', RECOVERY_LOCK_TTL_MS))) return
  try {
    const runs = await recoverExpiredSiteRuns(reconcileOutcomeRunsForAudit)
    if (runs > 0) logger.info('Recovered abandoned Site executions', { runs })
  } catch (err) {
    logger.error('Expired Site execution recovery failed', err instanceof Error ? err : new Error(String(err)))
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

async function projectWatchSetupTick(): Promise<void> {
  try { await initializeDefaultMonitoring(20) }
  catch (error) { logger.error('Project watch setup sweep failed', error instanceof Error ? error : new Error(String(error))) }
}

async function projectWatchTick(): Promise<void> {
  // Per-Site claims fence admission and schedule advancement. A second global
  // rate window would cap the entire service at one batch regardless of workers.
  try {
    const result = await processDueProjectWatches()
    if (result.processed > 0) logger.info('Project watch sweep', result)
  } catch (err) {
    logger.error('Project watch sweep failed', err instanceof Error ? err : new Error(String(err)))
  }
}

async function projectWatchNotificationTick(): Promise<void> {
  // Each alert has a due time and conditional database claim. The timer guard
  // bounds local work without imposing one batch on the whole service.
  try {
    const retried = await retryPendingWatchNotifications()
    if (retried > 0) logger.info('Project watch notification retries', { notificationRetries: retried })
  } catch (error) {
    logger.error('Project watch notification retries failed', error instanceof Error ? error : new Error(String(error)))
  }
}

async function googleContextTick(): Promise<void> {
  try {
    await withSchedulerLease('site-google-context', async signal => {
      await refreshDueGoogleContexts(new Date(), 20, { signal })
    })
  } catch (error) {
    logger.error('Site Google context refresh failed', error instanceof Error ? error : new Error(String(error)))
  }
}

async function websiteSummaryTick(): Promise<void> {
  try { await deliverWebsiteSummaries() }
  catch (error) { logger.error('Website summary sweep failed', error instanceof Error ? error : new Error(String(error))) }
}

async function emailDeliveryTick(): Promise<void> {
  try { await maintainEmailDelivery() }
  catch (error) { logger.error('Email delivery maintenance failed', error instanceof Error ? error : new Error(String(error))) }
}

async function emailRetryTick(): Promise<void> {
  try { await retryPendingNurtureEmails() }
  catch (error) { logger.error('Getting-started email retries failed', error instanceof Error ? error : new Error(String(error))) }
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

export async function providerRetentionTick(): Promise<void> {
  try {
    await withSchedulerLease('provider-budget-retention', async signal => {
      if (!signal.aborted) await deleteExpiredProviderWindows()
    })
  } catch (error) { logger.error('Provider budget retention failed', error instanceof Error ? error : new Error(String(error))) }
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
 * emails + knowledge-graph issue rollup). Runs in every dedicated worker.
 * Site admission uses per-Site database claims; other maintenance retains
 * its distributed lease or rate window. No external cron is required.
 * Idempotent; timers are unref'd so they never keep the process alive.
 */
export function startRecoveryScheduler() {
  if (scheduler && !scheduler.isStopped()) return scheduler
  scheduler = createTimerScheduler(error => logger.error('Scheduler callback failed', error))
  const jobs: Array<[() => Promise<unknown>, number, number]> = [
    [accountRetentionTick, 5000, 60_000],
    [() => dispatchPendingAudits(), 1000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [() => recoverPendingCoordinators(), 1000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [() => recoverActiveTaskGraphs(undefined, isAuditTaskTransportReady), 1000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [leasedRecovery('progressive-prescriptions', () => recoverPendingAiReviews()), 2000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [leasedRecovery('progressive-retirement', () => retireObsoleteTaskDeliveries()), 3000, PROGRESSIVE_RECOVERY_INTERVAL_MS],
    [recoveryTick, 15_000, RECOVERY_INTERVAL_MS],
    [projectionRecoveryTick, 16_000, RECOVERY_INTERVAL_MS],
    [siteRunRecoveryTick, 17_000, RECOVERY_INTERVAL_MS],
    [projectWatchSetupTick, 4000, MONITORING_SWEEP_INTERVAL_MS],
    [projectWatchTick, 5000, MONITORING_SWEEP_INTERVAL_MS],
    [projectWatchNotificationTick, 6000, MONITORING_SWEEP_INTERVAL_MS],
    [websiteSummaryTick, 8000, 60_000],
    [emailDeliveryTick, 9000, 60_000],
    [emailRetryTick, 10_000, 60_000],
    [googleContextTick, 47_000, WATCH_MAINTENANCE_INTERVAL_MS],
    [integrityWatchTick, 50_000, WATCH_MAINTENANCE_INTERVAL_MS],
    [nurtureTick, 60_000, NURTURE_INTERVAL_MS],
    [growthRollupTick, 90_000, ROLLUP_INTERVAL_MS],
    [analyticsTick, 120_000, ANALYTICS_INTERVAL_MS],
    [signalRetentionTick, 150_000, SIGNAL_RETENTION_INTERVAL_MS],
    [providerRetentionTick, 155_000, SIGNAL_RETENTION_INTERVAL_MS],
  ]
  for (const [tick, initial, interval] of jobs) {
    scheduler.schedule(tick, initial)
    scheduler.schedule(tick, interval, true)
  }
  logger.info('Recovery scheduler started')
  return scheduler
}
