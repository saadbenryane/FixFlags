import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { runNurtureSweep } from '@/lib/leads/run-nurture'

function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !authHeader) return false
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (token.length !== cronSecret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
}

// Optional manual/external trigger. The internal scheduler
// (lib/queue/recovery-scheduler.ts) runs this daily inside the worker.
export async function GET(req: NextRequest) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })
  }

  try {
    return NextResponse.json(await runNurtureSweep())
  } catch (err) {
    return handleRouteError(err)
  }
}
