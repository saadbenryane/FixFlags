import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadObservationSnapshot } from '@/lib/report/observation-snapshot'

/**
 * Owner-only read of one observation's workspace snapshot.
 * The Product Spine uses this to re-anchor the workspace to an earlier
 * product review, update review, or watch run.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: observationId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      return apiError('Sign in to view an observation', 401, { code: 'UNAUTHORIZED' })
    }

    const snapshot = await loadObservationSnapshot(session.user.id, observationId)
    if (!snapshot) {
      return apiError('Observation not found', 404)
    }

    return NextResponse.json({ observation: snapshot })
  } catch (error) {
    return handleRouteError(error, 'Observation unavailable')
  }
}
