import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { recheckAndCompare } from '@/lib/audit/task-contracts'
import { computeEnqueueDelay, getWorkerQueueEstimate } from '@/lib/queue/estimate'
import { RateLimitError, recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'
import { claimsAnonymousReport, readClaimedAnonymousIds } from '@/lib/audit/usage'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const claimedIds = await readClaimedAnonymousIds()
    const parent = await prisma.audit.findUnique({
      where: { id: parentId },
      select: { userId: true, parentId: true },
    })
    const claimedAnonymous =
      Boolean(parent) &&
      parent!.userId === null &&
      claimsAnonymousReport(claimedIds, parentId, parent!.parentId)

    const user = session?.user?.id
      ? await prisma.user.findUnique({ where: { id: session.user.id } })
      : null
    if (session?.user?.id && !user) {
      return apiError('User not found', 404)
    }
    if (!user && !claimedAnonymous) {
      return apiError('Sign in to run an update review', 401, { code: 'AUTH_REQUIRED' })
    }

    const clientId = requestClientId(req.headers)
    const [recheckLimit, workerEstimate] = await Promise.all([
      recordRateLimit({
        scope: 'report-recheck',
        identifier: user?.id ?? clientId,
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
      claimedAnonymous,
      delayMs: queue.delayMs,
      clientId,
    })

    const workReportId = outcome.reportId
    const baselineParentId = outcome.parentReportId ?? parentId
    return NextResponse.json(
      {
        reportId: workReportId,
        reportUrl: `/report/${encodeURIComponent(workReportId)}`,
        status: outcome.status,
        reused: outcome.reused,
        parentReportId: baselineParentId,
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
