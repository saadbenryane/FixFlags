import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { recheckAndCompare } from '@/lib/audit/task-contracts'
import { prisma } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parentId } = await params

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user) {
      return apiError('Sign in to start a re-check', 401)
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return apiError('User not found', 404)
    }

    const outcome = await recheckAndCompare({ parentReportId: parentId, user })

    return NextResponse.json(
      {
        reportId: outcome.reportId,
        reportUrl: outcome.reportUrl,
        status: outcome.status,
      },
      { status: 201 }
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
