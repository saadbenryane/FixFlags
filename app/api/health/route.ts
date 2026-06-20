import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'
import { handleRouteError } from '@/lib/api/errors'
import { checkR2Connection, isR2Configured } from '@/lib/storage/r2'

const STUCK_MINUTES = 15

export async function GET() {
  try {
    const checks: Record<string, string> = {}

    try {
      await prisma.$queryRaw`SELECT 1`
      checks.db = 'ok'
    } catch {
      checks.db = 'error'
    }

    let waiting = 0
    let active = 0
    let delayed = 0

    try {
      const counts = await Promise.race([
        getAuditQueue().getJobCounts('waiting', 'active', 'delayed'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
      checks.redis = 'ok'
      waiting = (counts as Record<string, number>).waiting ?? 0
      active = (counts as Record<string, number>).active ?? 0
      delayed = (counts as Record<string, number>).delayed ?? 0
      checks.queueWaiting = String(waiting)
      checks.queueActive = String(active)
      checks.queueDelayed = String(delayed)
    } catch {
      checks.redis = 'error'
    }

    let workerAlive = false
    try {
      const heartbeat = await readWorkerHeartbeat()
      workerAlive = heartbeat.alive
      checks.worker = heartbeat.alive ? 'ok' : 'missing'
      if (heartbeat.ageSeconds != null) {
        checks.workerHeartbeatAgeSeconds = String(heartbeat.ageSeconds)
      }
    } catch {
      checks.worker = 'unknown'
    }

    checks.workerLikelyIdle = String(waiting > 0 && active === 0 && !workerAlive)

    if (process.env.NODE_ENV === 'production') {
      if (!isR2Configured()) {
        checks.storage = 'unconfigured'
      } else {
        try {
          await Promise.race([
            checkR2Connection(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('timeout')), 3000)
            ),
          ])
          checks.storage = 'ok'
        } catch {
          checks.storage = 'error'
        }
      }
    } else {
      checks.storage = isR2Configured() ? 'configured' : 'local'
      const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)
      const stuckCount = await prisma.audit.count({
        where: {
          status: { notIn: ['COMPLETED', 'FAILED'] },
          updatedAt: { lt: cutoff },
        },
      })
      checks.stuckAudits = String(stuckCount)
    }

    const allOk =
      checks.db === 'ok' &&
      checks.redis === 'ok' &&
      checks.storage !== 'error' &&
      (checks.worker === 'ok' || checks.worker === 'unknown' || waiting === 0)

    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded', ...checks, ts: new Date().toISOString() },
      { status: allOk ? 200 : 503 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
