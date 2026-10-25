import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { repairScopeSchema } from '@/lib/sites/repair-scope'
import { loadSiteFixBundle } from '@/lib/sites/application/fix-bundle'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const scope = repairScopeSchema.safeParse(await request.json().catch(() => null))
    if (!scope.success) return apiError('Choose a valid fix scope.', 400)
    const bundle = scope.data.flagIds
      ? await loadSiteFixBundle(access.decision.site, scope.data.area, scope.data.flagIds)
      : await loadSiteFixBundle(access.decision.site, scope.data.area)
    return NextResponse.json({ ok: true, ...bundle }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    if (error instanceof SiteRunRefusal) return apiError(error.message, error.status, { code: error.code })
    return handleRouteError(error, 'Could not prepare fixes')
  }
}
