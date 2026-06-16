import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
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

    try {
      const counts = await Promise.race([
        getAuditQueue().getJobCounts('waiting', 'active', 'delayed'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
      checks.redis = 'ok'
      if (process.env.NODE_ENV !== 'production') {
        const waiting = (counts as Record<string, number>).waiting ?? 0
        const active = (counts as Record<string, number>).active ?? 0
        checks.queueWaiting = String(waiting)
        checks.queueActive = String(active)
        checks.queueDelayed = String((counts as Record<string, number>).delayed ?? 0)
        checks.workerLikelyIdle = String(waiting > 0 && active === 0)
      }
    } catch {
      checks.redis = 'error'
    }

    if (process.env.NODE_ENV === 'production') {
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
    } else {
      checks.storage = isR2Configured() ? 'configured' : 'local'
    }

    if (process.env.NODE_ENV !== 'production') {
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
      checks.storage !== 'error'
    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded', ...checks, ts: new Date().toISOString() },
      { status: allOk ? 200 : 503 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
