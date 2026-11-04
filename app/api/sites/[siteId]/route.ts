import { NextResponse } from 'next/server'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { removeSite, siteRemovalSchema } from '@/lib/sites/application/settings-commands'
import { readSiteEvidence } from '@/lib/sites/application/site-evidence-read'

export async function GET(
  request: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  let response: Response
  try {
    response = await readSite(request, context)
  } catch (error) {
    response = handleRouteError(error)
  }
  response.headers.set('Cache-Control', 'private, no-store')
  return response
}

async function readSite(request: Request, context: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await context.params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) return apiError(access.message, access.status)
  const scope = new URL(request.url).searchParams.get('scope')
  if (scope === 'identity') {
    // Echo the authorized request alias, which can survive a provisional claim.
    const identity = await readSiteEvidence(access.decision.site, async () => ({ siteId,
      hostname: new URL(access.decision.site.url).hostname.replace(/^www\./, '') }))
    return NextResponse.json(identity)
  }
  const home = await loadSiteHome(access.decision.site.siteId, { ownerEvidence: access.decision.role === 'owner', viewerAuthenticated: access.decision.authenticated, site: access.decision.site,
    readScope: scope === 'settings' && access.decision.role === 'owner' ? 'settings' : 'overview' })
  return home ? NextResponse.json(home) : apiError('Site not found', 404)
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const projectId = access.decision.site.projectId
    if (access.decision.role !== 'owner' || !projectId) return apiError('Claim this Site first.', 403)
    const raw = await request.text()
    let body: unknown
    try { body = raw ? JSON.parse(raw) : {} }
    catch { return apiError('Choose valid Site removal options.', 400) }
    const parsed = siteRemovalSchema.safeParse(body)
    if (!parsed.success) return apiError('Choose valid Site removal options.', 400)
    const result = await removeSite({ projectId, userId: access.decision.site.userId! }, parsed.data)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return handleRouteError(error, 'Could not remove Site')
  }
}
