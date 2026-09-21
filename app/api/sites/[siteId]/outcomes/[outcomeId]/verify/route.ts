import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { requestOutcomeRun } from '@/lib/sites/application/run-requests'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string; outcomeId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError('Sign in to verify this Outcome.', 401)
    const { siteId, outcomeId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    if (access.decision.role !== 'owner' || !access.decision.site.projectId) {
      return apiError('Claim this Site before verifying an Outcome.', 403)
    }
    const idempotencyKey = req.headers.get('idempotency-key') ?? undefined
    const result = await requestOutcomeRun({
      projectId: access.decision.site.projectId,
      outcomeId,
      userId: session.user.id,
      source: 'WEB',
      idempotencyKey,
    })
    return NextResponse.json(result, { status: result.reused ? 200 : 202 })
  } catch (error) {
    return handleRouteError(error, 'Could not start this verification')
  }
}
