import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requestSiteRun } from '@/lib/sites/application/run-requests'
import { accountAdmission } from '@/lib/sites/accounts/store'

const inputSchema = z.object({ action: z.enum(['retest', 'cleanup']) }).strict()
export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const input = inputSchema.safeParse(await request.json().catch(() => null))
    if (!input.success) return apiError('Choose a valid account-check action.', 400)
    if (!await accountAdmission(access.projectId, input.data.action)) return apiError('Automatic account checks are paused or unavailable.', 409)
    const key = request.headers.get('Idempotency-Key')
    if (!key || key.length > 200) return apiError('An account-check request identity is required.', 400)
    const started = await requestSiteRun({ projectId: access.projectId, userId: access.decision.site.userId!, source: 'WEB',
      scope: 'ACCOUNT_CHECKS', accountMode: input.data.action, outcomeIds: [], idempotencyKey: key })
    return NextResponse.json(started, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleRouteError(error) }
}
