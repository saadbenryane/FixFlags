import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { runStuckAuditRecoverySweep } from '@/lib/audit/recover-audit-job'

// Optional manual/external trigger. The internal recovery scheduler
// (lib/queue/recovery-scheduler.ts) runs the same sweep automatically inside
// every worker, so this endpoint is no longer required for production.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })
  }

  try {
    return NextResponse.json(await runStuckAuditRecoverySweep())
  } catch (err) {
    return handleRouteError(err)
  }
}
