import { NextResponse } from 'next/server'
import {
  readStalledJobCount,
  readWorkerHeartbeat,
} from '@/lib/queue/worker-heartbeat'
import { getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { prisma } from '@/lib/db'
import { AUDIT_DEADLINE_MS } from '@/lib/audit/pipeline-config'

export const dynamic = 'force-dynamic'
const EVENT_LOOP_LAG_LIMIT_MS = 250

/**
 * Worker/queue diagnostics. Separate from /api/health (the Railway deploy
 * healthcheck, which stays DB-only and lenient): this endpoint always returns
 * HTTP 200 with an operational snapshot so it can never gate a deploy, while
 * still making a missing or dead worker obvious. `ok` is false when Redis is
 * unreachable or the worker heartbeat is stale.
 */
export async function GET() {
  const eventLoopStarted = performance.now()
  await new Promise<void>((resolve) => setImmediate(resolve))
  const eventLoopLagMs = Math.round((performance.now() - eventLoopStarted) * 10) / 10

  const [hb, est, oldest, overdue, stalled] = await Promise.allSettled([
    readWorkerHeartbeat(),
    getWorkerQueueEstimate(),
    prisma.audit.findFirst({
      where: { status: { notIn: ['COMPLETED', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
      select: { status: true, createdAt: true, startedAt: true },
    }),
    prisma.audit.count({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        startedAt: { lt: new Date(Date.now() - AUDIT_DEADLINE_MS) },
      },
    }),
    readStalledJobCount(),
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
    (queue?.activeJobs ?? 0) === 0 && worker.activeBrowserContexts > 0
  const excessiveEventLoopLag = eventLoopLagMs > EVENT_LOOP_LAG_LIMIT_MS
  const overdueAuditCount = overdue.status === 'fulfilled' ? overdue.value : null
  const ok =
    redisReachable &&
    worker.alive &&
    !duplicateLocalWorkers &&
    !leakedBrowserContexts &&
    !excessiveEventLoopLag &&
    overdueAuditCount === 0
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
    ok,
    status: !redisReachable
      ? 'redis_unreachable'
      : !worker.alive
        ? 'worker_down'
        : duplicateLocalWorkers
          ? 'duplicate_workers'
          : leakedBrowserContexts
            ? 'browser_context_leak'
            : excessiveEventLoopLag
              ? 'event_loop_lag'
              : overdueAuditCount !== 0
                ? 'audit_overdue'
                : 'ok',
    redis: redisReachable ? 'ok' : 'unreachable',
    processRole: process.env.FIXFLAGS_PROCESS_ROLE ?? 'web',
    configuredConcurrency: worker.configuredConcurrency,
    eventLoopLagMs,
    worker,
    queue,
    oldestAudit,
    stalledJobCount: stalled.status === 'fulfilled' ? stalled.value : null,
    overdueAuditCount,
  })
}
