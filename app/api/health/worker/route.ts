import { NextResponse } from 'next/server'
import {
  readStalledJobCount,
  readWorkerHeartbeat,
} from '@/lib/queue/worker-heartbeat'
import { getWorkerExecutionCounts } from '@/lib/queue/estimate'
import { getRateLimitRedisHealth } from '@/lib/security/rate-limit'
import { readMonitoringHealth } from '@/lib/health/monitoring'
import { readExecutionHealth } from '@/lib/health/execution'

export const dynamic = 'force-dynamic'
const EVENT_LOOP_LAG_LIMIT_MS = 250

/**
 * Worker/queue diagnostics. Separate from /api/health (the Railway deploy
 * healthcheck, which stays DB-only and lenient): this endpoint always returns
 * HTTP 200 with an operational snapshot so it can never gate a deploy, while
 * still exposing unavailable execution and overdue saved monitoring obligations.
 * This snapshot does not establish a historical fulfillment rate or delivery.
 */
export async function GET() {
  const eventLoopStarted = performance.now()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const eventLoopLagMs = Math.round((performance.now() - eventLoopStarted) * 10) / 10

  const rateLimit = getRateLimitRedisHealth()
  const now = new Date()
  const [hb, est, executionResult, stalled, monitoringResult] = await Promise.allSettled([
    readWorkerHeartbeat(),
    getWorkerExecutionCounts(),
    readExecutionHealth(now),
    readStalledJobCount(),
    readMonitoringHealth(now),
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
  const leakedBrowserContexts =
    queue !== null && queue.activeJobs === 0 && worker.activeBrowserContexts > 0
  const excessiveEventLoopLag = eventLoopLagMs > EVENT_LOOP_LAG_LIMIT_MS
  const overdueAuditCount = executionResult.status === 'fulfilled' ? executionResult.value.overdueAuditCount : null
  const monitoring = monitoringResult.status === 'fulfilled' ? monitoringResult.value : null
  const problems = {
    redis_unreachable: !redisReachable,
    worker_down: !worker.alive,
    queue_unavailable: queue === null,
    browser_unavailable: !worker.browserOk,
    duplicate_workers: duplicateLocalWorkers,
    browser_context_leak: leakedBrowserContexts,
    event_loop_lag: excessiveEventLoopLag,
    audit_unavailable: overdueAuditCount === null,
    audit_overdue: overdueAuditCount !== null && overdueAuditCount > 0,
    monitoring_unavailable: monitoring === null,
    monitoring_gaps: monitoring !== null && !monitoring.ok,
  }
  const status = Object.entries(problems).find(([, present]) => present)?.[0] ?? 'ok'
  const oldestAudit = executionResult.status === 'fulfilled' ? executionResult.value.oldestAudit : null

  return NextResponse.json({
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
    overdueAuditCount,
    monitoring,
  })
}
