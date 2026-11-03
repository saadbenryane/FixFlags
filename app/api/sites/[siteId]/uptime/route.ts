import { NextResponse } from 'next/server'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { InvalidUptimeCursorError, loadUptimeHistory } from '@/lib/uptime/queries'
import { uptimeCursorSchema, uptimeWindowSchema } from '@/lib/uptime/contracts'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  let response: Response
  try {
    response = await readHistory(request, context)
  } catch (error) {
    response = error instanceof InvalidUptimeCursorError
      ? apiError('Invalid Uptime history cursor', 400) : handleRouteError(error)
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

async function readHistory(request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params
  const access = await requireSiteOwner(siteId)
  if (!access.ok) return apiError(access.message, access.status)
  const query = new URL(request.url).searchParams
  const window = uptimeWindowSchema.safeParse(query.get('window') ?? '24h')
  const cursor = uptimeCursorSchema.nullable().safeParse(query.get('cursor'))
  if (!window.success || !cursor.success) return apiError('Invalid Uptime history query', 400)
  const history = await loadUptimeHistory(access.decision.site, window.data, cursor.data)
  if (!history) return apiError('Site not found', 404)
  return NextResponse.json({ siteId: access.decision.site.siteId, ...history })
}
