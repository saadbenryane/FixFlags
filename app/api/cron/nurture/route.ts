import { NextRequest, NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { verifyCronSecret } from '@/lib/api/cron-auth'
import { runNurtureSweep } from '@/lib/leads/run-nurture'

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
