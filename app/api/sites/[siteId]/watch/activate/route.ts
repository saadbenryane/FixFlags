import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { activateSiteMonitoring } from '@/lib/sites/application/monitoring-activation'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST(req: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const body = z.object({ interval: z.enum(['weekly', 'daily']) }).safeParse(await req.json().catch(() => null))
    if (!body.success) return apiError('Choose a monitoring schedule.', 400)
    const result = await activateSiteMonitoring({ siteId: access.decision.site.siteId, userId: access.decision.site.userId!, interval: body.data.interval })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) { return handleRouteError(error, 'We couldn’t turn on monitoring.') }
}
