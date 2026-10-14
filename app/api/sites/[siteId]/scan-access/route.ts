import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { parseScanAccessInput, scanAccessInputSchema } from '@/lib/audit/scan-access'
import { readSavedScanAccess, saveScanAccess } from '@/lib/sites/application/scan-access-commands'

const payload = z.object({ scanAccess: scanAccessInputSchema.nullable() }).strict()
type Context = { params: Promise<{ siteId: string }> }
async function owner(context: Context) {
  const { siteId } = await context.params
  return requireSiteOwner(siteId)
}
export async function GET(_request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (!access.ok) return apiError(access.message, access.status)
    return NextResponse.json(await readSavedScanAccess(access.projectId, access.decision.site.userId!))
  } catch (error) { return handleRouteError(error) }
}
export async function PUT(request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (!access.ok) return apiError(access.message, access.status)
    const body = payload.safeParse(await request.json().catch(() => null))
    if (!body.success) return apiError('Provide website access or explicitly remove it.', 400)
    const config = body.data.scanAccess === null ? null : parseScanAccessInput(body.data.scanAccess)
    if (body.data.scanAccess && !config) return apiError('Website access must include HTTP Basic credentials, cookies, or headers.', 400)
    return NextResponse.json(await saveScanAccess(access.projectId, access.decision.site.userId!, config))
  } catch (error) { return handleRouteError(error) }
}
export async function DELETE(_request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (!access.ok) return apiError(access.message, access.status)
    return NextResponse.json(await saveScanAccess(access.projectId, access.decision.site.userId!, null))
  } catch (error) { return handleRouteError(error) }
}
