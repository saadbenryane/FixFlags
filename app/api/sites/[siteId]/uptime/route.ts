import { NextResponse } from 'next/server'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { InvalidUptimeCursorError, loadUptimeHistory } from '@/lib/uptime/queries'
import { uptimeCursorSchema, uptimeWindowSchema } from '@/lib/uptime/contracts'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const query = new URL(request.url).searchParams
    const window = uptimeWindowSchema.safeParse(query.get('window') ?? '24h')
    const cursor = uptimeCursorSchema.nullable().safeParse(query.get('cursor'))
    if (!window.success || !cursor.success) return apiError('Invalid Uptime history query', 400)
    const history = await loadUptimeHistory(access.projectId, window.data, cursor.data)
    if (!history) return apiError('Site not found', 404)
    return NextResponse.json({ siteId: access.decision.site.siteId, ...history }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof InvalidUptimeCursorError) return apiError('Invalid Uptime history cursor', 400)
    return handleRouteError(error)
  }
}
