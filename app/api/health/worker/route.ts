import { NextResponse } from 'next/server'
import {
  readStalledJobCount,
  readWorkerHeartbeat,
} from '@/lib/queue/worker-heartbeat'
import { getWorkerExecutionCounts } from '@/lib/queue/estimate'
import { prisma } from '@/lib/db'
import { getRateLimitRedisHealth } from '@/lib/security/rate-limit'
import { auditDeadlineMsForDepth } from '@/lib/audit/review-depth'
import { readMonitoringHealth } from '@/lib/health/monitoring'

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
  const [hb, est, oldest, overdue, stalled, monitoringResult] = await Promise.allSettled([
    readWorkerHeartbeat(),
    getWorkerExecutionCounts(),
    prisma.audit.findFirst({
      where: { status: { notIn: ['COMPLETED', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
      select: { status: true, createdAt: true, startedAt: true },
    }),
    prisma.audit.count({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        OR: ([1, 2, 3] as const).map((depth) => ({ reviewDepth: depth, startedAt: { lt: new Date(Date.now() - auditDeadlineMsForDepth(depth)) } })),
      },
    }),
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
  const leakedBrowserContexts =
    queue !== null && queue.activeJobs === 0 && worker.activeBrowserContexts > 0
  const excessiveEventLoopLag = eventLoopLagMs > EVENT_LOOP_LAG_LIMIT_MS
  const overdueAuditCount = overdue.status === 'fulfilled' ? overdue.value : null
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
  const oldestAudit =
    oldest.status === 'fulfilled' && oldest.value
      ? {
          status: oldest.value.status,
          ageSeconds: Math.round(
            (Date.now() - oldest.value.createdAt.getTime()) / 1000
          ),
          startedAt: oldest.value.startedAt,
        }
      : null

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
