import { NextRequest, NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireAdmin, isAdminResponse } from '@/lib/auth/require-admin'
import { retryFailedExecution } from '@/lib/sites/application/run-requests'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    if (isAdminResponse(admin)) return admin

    const { id } = await params
    const result = await retryFailedExecution(id)
    if (!result.ok) return apiError(result.error, result.status, { code: result.status === 409 ? 'NOT_FAILED' : undefined })
    return NextResponse.json({ auditId: result.auditId, runId: result.runId, status: 'QUEUED' })
  } catch (error) {
    return handleRouteError(error, 'Failed to retry audit')
  }
}
