import { NextResponse } from 'next/server'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { getWorkerQueueEstimate } from '@/lib/queue/estimate'

export const dynamic = 'force-dynamic'

/**
 * Worker/queue diagnostics. Separate from /api/health (the Railway deploy
 * healthcheck, which stays DB-only and lenient): this endpoint always returns
 * HTTP 200 with an operational snapshot so it can never gate a deploy, while
 * still making a missing or dead worker obvious. `ok` is false when Redis is
 * unreachable or the worker heartbeat is stale.
 */
export async function GET() {
  const [hb, est] = await Promise.allSettled([
    readWorkerHeartbeat(),
    getWorkerQueueEstimate(),
  ])

  const redisReachable = hb.status === 'fulfilled' || est.status === 'fulfilled'

  const worker =
    hb.status === 'fulfilled'
      ? hb.value
      : { alive: false, lastSeenMs: null, ageSeconds: null }

  const queue =
    est.status === 'fulfilled'
      ? {
          activeJobs: est.value.activeJobs,
          waitingJobs: est.value.waitingJobs,
          delayedJobs: est.value.delayedJobs,
        }
      : null

  const ok = redisReachable && worker.alive

  return NextResponse.json({
    ok,
    status: !redisReachable ? 'redis_unreachable' : worker.alive ? 'ok' : 'worker_down',
    redis: redisReachable ? 'ok' : 'unreachable',
    worker,
    queue,
  })
}
