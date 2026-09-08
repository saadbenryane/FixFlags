import { NextResponse } from 'next/server'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { handleRouteError, apiError } from '@/lib/api/errors'

export async function GET(
  _req: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const home = await loadSiteHome(siteId)
    if (!home) return apiError('Site not found', 404)
    return NextResponse.json(home)
  } catch (error) {
    return handleRouteError(error)
  }
}
