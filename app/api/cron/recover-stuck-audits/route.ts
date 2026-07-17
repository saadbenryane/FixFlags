import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { runStuckAuditRecoverySweep } from '@/lib/audit/recover-audit-job'

function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !authHeader) return false
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (token.length !== cronSecret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
}

// Optional manual/external trigger. The internal recovery scheduler
// (lib/queue/recovery-scheduler.ts) runs the same sweep automatically inside
// every worker, so this endpoint is no longer required for production.
export async function GET(req: Request) {
  if (!verifyCronSecret(req.headers.get('authorization'))) {
    return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })
  }

  try {
    return NextResponse.json(await runStuckAuditRecoverySweep())
  } catch (err) {
    return handleRouteError(err)
  }
}
