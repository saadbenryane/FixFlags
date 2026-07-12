import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { startMonitoringAudit } from '@/lib/audit/monitoring'
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

    const outcome = await startMonitoringAudit(parentId, user)
    if (!outcome.ok) {
      return apiError(outcome.error, outcome.status, {
        code: outcome.code,
        action: outcome.action,
      })
    }

    return NextResponse.json(
      {
        reportId: outcome.result.auditId,
        status: outcome.result.status,
      },
      { status: 201 }
    )
  } catch (err) {
    return handleRouteError(err)
  }
}
