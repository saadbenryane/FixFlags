import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { requireSiteAccess } from '@/lib/sites/request-access'

const requestSchema = z.object({
  outcomeIds: z.array(z.string().min(1)).min(1).max(20),
  environment: z.string().min(1).max(80).default('production'),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ siteId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError('Sign in to run these Outcomes.', 401)

    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    if (access.decision.role !== 'owner' || !access.decision.site.projectId) {
      return apiError('Claim this Site before running Outcomes.', 403)
    }

    const parsed = requestSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Select at least one valid Outcome.', 400)
    const idempotencyKey = request.headers.get('idempotency-key')?.trim()
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 160) {
      return apiError('Send an Idempotency-Key between 8 and 160 characters.', 400)
    }

    const result = await requestSiteRun({
      projectId: access.decision.site.projectId,
      outcomeIds: parsed.data.outcomeIds,
      userId: session.user.id,
      source: 'API',
      environment: parsed.data.environment,
      idempotencyKey,
      context: { action: 'run_outcomes' },
    })
    return NextResponse.json(result, { status: result.reused ? 200 : 202 })
  } catch (error) {
    return handleRouteError(error, 'Could not start this Site run')
  }
}
