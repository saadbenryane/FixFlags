import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { saveSiteSettings, siteSettingsWriteSchema } from '@/lib/sites/application/settings-commands'
import { requireSiteAccess } from '@/lib/sites/request-access'

export async function PATCH(request: Request, context: { params: Promise<{ siteId: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) return apiError('Sign in to change Site settings.', 401)
    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const projectId = access.decision.site.projectId
    if (access.decision.role !== 'owner' || !projectId) return apiError('Claim this Site first.', 403)
    const parsed = siteSettingsWriteSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return apiError('Choose valid Site settings.', 400)
    const result = await saveSiteSettings({ projectId, userId: session.user.id }, parsed.data)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return handleRouteError(error)
  }
}
