import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { getOwnedRun } from '@/lib/sites/application/run-requests'

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string; runId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError('Sign in to view this run.', 401)
    const { siteId, runId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    if (access.decision.role !== 'owner') return apiError('Run not found', 404)
    const run = await getOwnedRun(session.user.id, runId)
    if (!run || run.outcomeId == null) return apiError('Run not found', 404)
    return NextResponse.json(run)
  } catch (error) {
    return handleRouteError(error)
  }
}
