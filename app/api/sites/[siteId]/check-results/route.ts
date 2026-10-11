import { NextResponse } from 'next/server'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { loadSiteCheckResultPage } from '@/lib/sites/application/check-results'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { apiError, handleRouteError } from '@/lib/api/errors'

export async function GET(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const cursor = new URL(request.url).searchParams.get('cursor') ?? undefined
    if (cursor && !/^[a-zA-Z0-9_-]{1,160}$/.test(cursor)) return apiError('Invalid check history cursor', 400)
    const home = await loadSiteHome(access.decision.site.siteId)
    if (!home) return apiError('Site not found', 404)
    const page = await loadSiteCheckResultPage(access.decision.site, home.audit.id, cursor)
    return NextResponse.json(page, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid check history cursor') return apiError(error.message, 400)
    return handleRouteError(error, 'Could not load check results')
  }
}
