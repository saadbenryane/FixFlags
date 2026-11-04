import { NextResponse } from 'next/server'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireRepairReader } from '@/lib/sites/repair-reader-access'
import { repairBundlePageSchema } from '@/lib/sites/repair-scope'
import { loadSiteFixBundle } from '@/lib/sites/application/fix-bundle'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
import { repairFileRequestSchema, REPAIR_FILE_TIMEOUT_MS } from '@/lib/sites/repair-file-contract'
import { prepareSiteRepairFile, repairFileStream } from '@/lib/sites/application/repair-file'

async function prepareBundle(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireRepairReader(request, siteId)
    if (!access.ok) return access.response
    const body: unknown = await request.json().catch(() => null)
    const view = new URL(request.url).searchParams.get('view')
    if (view === 'file') {
      const scope = repairFileRequestSchema.safeParse(body)
      if (!scope.success) return apiError('Choose a valid repair file scope and revision.', 400)
      const cancel = new AbortController()
      const signal = AbortSignal.any([request.signal, cancel.signal, AbortSignal.timeout(REPAIR_FILE_TIMEOUT_MS)])
      const authorize = async () => {
        const current = await requireRepairReader(request, siteId)
        if (!current.ok || current.site.userId !== access.site.userId || current.site.projectId !== access.site.projectId)
          throw new SiteRunRefusal('Site not found', 404)
      }
      const file = await prepareSiteRepairFile(access.site, scope.data, signal, authorize)
      return new Response(repairFileStream(file, cancel, signal), { headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="fixflags-repairs.json"',
        'X-Content-Type-Options': 'nosniff',
      } })
    }
    if (view !== null) return apiError('Choose a valid repair view.', 400)
    const scope = repairBundlePageSchema.safeParse(body)
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
