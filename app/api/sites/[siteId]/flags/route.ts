import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'

export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const home = await loadSiteHome(access.decision.site.siteId)
    if (!home) return apiError('Site not found', 404)
    return NextResponse.json({ flags: home.flags, recommendations: home.recommendations })
  } catch (error) {
    return handleRouteError(error, 'Could not load Flags')
  }
}
