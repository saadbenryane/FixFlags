import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { resolveCanvasReportAccess } from '@/lib/canvas/access'
import { canvasAccessError } from '@/lib/canvas/http'
import { canvasRepository } from '@/lib/canvas/repository'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; canvasId: string }> }
) {
  try {
    const { id, canvasId } = await params
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const access = await resolveCanvasReportAccess(id, session?.user?.id)
    if (!access.allowed) return canvasAccessError(access)
    const canvas = await canvasRepository.getCanvas(canvasId)
    if (!canvas || canvas.sourceAuditId !== id || canvas.projectId !== access.audit.projectId) {
      return apiError('Canvas not found', 404)
    }
    const current = canvas.currentVersion > 0
      ? await canvasRepository.getVersion(canvas.id, canvas.currentVersion)
      : null
    return NextResponse.json({ canvas, current })
  } catch (error) {
    return handleRouteError(error, 'Could not load Canvas')
  }
}
