import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { recheckAndCompare } from '@/lib/audit/task-contracts'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { RateLimitError, recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) {
      return apiError('Sign in to run an update review', 401, { code: 'AUTH_REQUIRED' })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return apiError('User not found', 404)
    }

    const clientId = requestClientId(req.headers)
    const [recheckLimit, workerEstimate] = await Promise.all([
      recordRateLimit({
        scope: 'report-recheck',
        identifier: user.id,
        limit: 20,
        windowSeconds: 3600,
        onRedisDown: 'reject',
      }),
      getWorkerQueueEstimate(),
    ])

    if (recheckLimit.exceeded) {
      throw new RateLimitError(recheckLimit.retryAfterSeconds)
    }

    const queue = computeEnqueueDelay(recheckLimit.exceeded ? recheckLimit.retryAfterSeconds : 0, workerEstimate)

    const outcome = await recheckAndCompare({
      parentReportId: parentId,
      user,
      delayMs: queue.delayMs,
      clientId,
    })

    return NextResponse.json(
      {
        reportId: outcome.parentReportId ?? parentId,
        workReportId: outcome.reportId,
        reportUrl: `/report/${encodeURIComponent(outcome.parentReportId ?? parentId)}`,
        status: outcome.status,
        reused: outcome.reused,
        parentReportId: outcome.parentReportId ?? parentId,
      },
      { status: outcome.reused ? 200 : 201 }
    )
  } catch (err) {
    const taskError = err as Error & { status?: number; code?: string; action?: string }
    if (taskError.status) {
      return apiError(taskError.message, taskError.status, {
        code: taskError.code,
        action: taskError.action,
      })
    }
    return handleRouteError(err)
  }
}
