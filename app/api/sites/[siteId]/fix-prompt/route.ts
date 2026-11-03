import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireRepairReader } from '@/lib/sites/repair-reader-access'
import { repairBundlePageSchema } from '@/lib/sites/repair-scope'
import { loadSiteFixBundle } from '@/lib/sites/application/fix-bundle'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

async function prepareBundle(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireRepairReader(request, siteId)
    if (!access.ok) return access.response
    const scope = repairBundlePageSchema.safeParse(await request.json().catch(() => null))
    if (!scope.success) return apiError('Choose a valid fix scope.', 400)
    const bundle = await loadSiteFixBundle(access.site, scope.data.area, scope.data.flagIds,
      { offset: scope.data.offset, manifestHash: scope.data.manifestHash })
    return NextResponse.json({ ok: true, ...bundle }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', Vary: 'Cookie, Authorization' } })
  } catch (error) {
    if (error instanceof SiteRunRefusal) return apiError(error.message, error.status, { code: error.code })
    return handleRouteError(error, 'Could not prepare fixes')
  }
}

export async function POST(request: Request, context: { params: Promise<{ siteId: string }> }) {
  const response = await prepareBundle(request, context)
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Vary', 'Cookie, Authorization')
  return response
}
