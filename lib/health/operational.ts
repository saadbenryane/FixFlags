import { readExecutionHealth } from './execution'
import {
  readStalledJobCount,
  readWorkerHeartbeat,
} from '@/lib/queue/worker-heartbeat'
import { getWorkerExecutionCounts } from '@/lib/queue/estimate'
import { getRateLimitRedisHealth } from '@/lib/security/rate-limit'
import { readMonitoringHealth } from '@/lib/health/monitoring'

const EVENT_LOOP_LAG_LIMIT_MS = 250

/** One operational assessment shared by diagnostics and continuous monitoring. */
export async function readWorkerOperationalHealth() {
  const eventLoopStarted = performance.now()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const eventLoopLagMs = Math.round((performance.now() - eventLoopStarted) * 10) / 10

  const rateLimit = getRateLimitRedisHealth()
  const [hb, est, executionResult, stalled, monitoringResult] = await Promise.allSettled([
    readWorkerHeartbeat(),
    getWorkerExecutionCounts(),
    readExecutionHealth(new Date()),
    readStalledJobCount(),
    readMonitoringHealth(),
  ])

  const redisReachable = hb.status === 'fulfilled' || est.status === 'fulfilled'

  const worker =
    hb.status === 'fulfilled'
      ? hb.value
      : {
          alive: false,
          lastSeenMs: null,
          ageSeconds: null,
          workerCount: 0,
          browserOk: false,
          activeBrowserContexts: 0,
          configuredConcurrency: 0,
        }

  const queue =
    est.status === 'fulfilled'
      ? {
          activeJobs: est.value.activeJobs,
          waitingJobs: est.value.waitingJobs,
          delayedJobs: est.value.delayedJobs,
        }
      : null

  const duplicateLocalWorkers =
    process.env.NODE_ENV !== 'production' && worker.workerCount > 1
  const ownership = 'contextOwnership' in worker ? worker.contextOwnership : null
  const unknownBrowserOwnership = worker.activeBrowserContexts > 0 && !ownership
  const excessiveEventLoopLag = eventLoopLagMs > EVENT_LOOP_LAG_LIMIT_MS
  const overdueAuditCount = executionResult.status === 'fulfilled' ? executionResult.value.overdueAuditCount : null
  const monitoring = monitoringResult.status === 'fulfilled' ? monitoringResult.value : null
  const problems = {
    redis_unreachable: !redisReachable,
    worker_down: !worker.alive,
    queue_unavailable: queue === null,
    browser_unavailable: !worker.browserOk,
    duplicate_workers: duplicateLocalWorkers,
    browser_context_ownership_unknown: unknownBrowserOwnership,
    browser_context_unattributed: ownership != null && ownership.unattributed > 0,
    browser_context_cleanup_overdue: ownership != null && ownership.overdue > 0,
    event_loop_lag: excessiveEventLoopLag,
    audit_unavailable: overdueAuditCount === null,
    audit_overdue: overdueAuditCount !== null && overdueAuditCount > 0,
    monitoring_unavailable: monitoring === null,
    monitoring_gaps: monitoring !== null && !monitoring.ok,
  }
  const status = Object.entries(problems).find(([, present]) => present)?.[0] ?? 'ok'
  const oldestAudit = executionResult.status === 'fulfilled' ? executionResult.value.oldestAudit : null

  return {
    ok: status === 'ok',
    status,
    redis: redisReachable ? 'ok' : 'unreachable',
    rateLimit,
    processRole: process.env.FIXFLAGS_PROCESS_ROLE ?? 'web',
    configuredConcurrency: worker.configuredConcurrency,
    eventLoopLagMs,
    worker,
    queue,
    oldestAudit,
    stalledJobCount: stalled.status === 'fulfilled' ? stalled.value : null,
    stalledEvents: { count: stalled.status === 'fulfilled' ? stalled.value : null,
      scope: 'historical_redis_counter', currentStalledJobs: null },
    overdueAuditCount,
    monitoring,
  }
}
