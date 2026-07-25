import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { verifyCronSecret } from '@/lib/api/cron-auth'
import { runStuckAuditRecoverySweep } from '@/lib/audit/recover-audit-job'

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
