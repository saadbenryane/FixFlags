import { NextRequest, NextResponse } from 'next/server'
import { watchScheduleSchema } from '@/lib/sites/watch-schedule'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { activateSiteMonitoring } from '@/lib/sites/application/monitoring-activation'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function POST(req: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const body = watchScheduleSchema.refine(value => value.interval !== null).safeParse(await req.json().catch(() => null))
    if (!body.success) return apiError('Choose a monitoring schedule.', 400)
    const result = await activateSiteMonitoring({ siteId: access.decision.site.siteId, userId: access.decision.site.userId!, interval: body.data.interval!, ...(body.data.everyMinutes !== undefined ? { everyMinutes: body.data.everyMinutes } : {}) })
    return NextResponse.json(result, { status: result.ok ? 200 : 400 })
  } catch (error) { return handleRouteError(error, 'We couldn’t turn on monitoring.') }
}
