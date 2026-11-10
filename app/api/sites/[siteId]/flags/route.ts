import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { SITE_ERRORS } from '@/lib/marketing/copy/errors'

export async function GET(_request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    // Results require the account that owns the Site.
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const home = await loadSiteHome(access.decision.site.siteId, { ownerEvidence: true, viewerAuthenticated: access.decision.authenticated })
    if (!home) return apiError(SITE_ERRORS.notFound, 404)
    return NextResponse.json({ flags: home.flags, recommendations: home.recommendations })
  } catch (error) {
    return handleRouteError(error, 'Could not load Flags')
  }
}
