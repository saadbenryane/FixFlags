import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { readWorkerHeartbeat } from '@/lib/queue/worker-heartbeat'

export async function GET() {
  const checks: Record<string, string> = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch {
    checks.db = 'error'
  }

  try {
    await Promise.race([
      getAuditQueue().getJobCounts('waiting', 'active', 'delayed'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
    ])
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  try {
    const heartbeat = await readWorkerHeartbeat()
    checks.worker = heartbeat.alive ? 'ok' : 'missing'
  } catch {
    checks.worker = 'unknown'
  }

  return NextResponse.json({ status: 'ok', ...checks })
}
