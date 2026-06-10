import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'

export async function GET() {
  const checks: Record<string, string> = {}

  // DB check
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch {
    checks.db = 'error'
  }

  // Redis check
  try {
    if (process.env.REDIS_URL) {
      const counts = await Promise.race([
        getAuditQueue().getJobCounts('waiting', 'active'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ])
      checks.redis = 'ok'
      checks.queueWaiting = String((counts as Record<string, number>).waiting ?? 0)
      checks.queueActive = String((counts as Record<string, number>).active ?? 0)
    } else {
      checks.redis = 'not_configured'
    }
  } catch {
    checks.redis = 'error'
  }

  const allOk = checks.db === 'ok'
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', ...checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}
