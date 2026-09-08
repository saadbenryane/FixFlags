import { NextResponse } from 'next/server'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const home = await loadSiteHome(access.decision.site.siteId)
    if (!home) return apiError('Site not found', 404)
    return NextResponse.json(home)
  } catch (error) {
    return handleRouteError(error)
  }
}
