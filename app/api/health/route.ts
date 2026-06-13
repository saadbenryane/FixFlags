import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { handleRouteError } from '@/lib/api/errors'

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
      checks.queueWaiting = String((counts as Record<string, number>).waiting ?? 0)
      checks.queueActive = String((counts as Record<string, number>).active ?? 0)
      checks.queueDelayed = String((counts as Record<string, number>).delayed ?? 0)
    } catch {
      checks.redis = 'error'
    }

    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)
    const stuckCount = await prisma.audit.count({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
    })
    checks.stuckAudits = String(stuckCount)

    const allOk = checks.db === 'ok' && checks.redis === 'ok'
    return NextResponse.json(
      { status: allOk ? 'ok' : 'degraded', ...checks, ts: new Date().toISOString() },
      { status: allOk ? 200 : 503 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
