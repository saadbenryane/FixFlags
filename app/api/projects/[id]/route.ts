import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { removeSite, siteRemovalSchema, updateOwnedSiteIdentity } from '@/lib/sites/application/settings-commands'

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  url: z.string().url().optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to update projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'project-update', identifier: `${session.user.id}:${clientId}`, limit: 20, windowSeconds: 60 })

    const { id } = await context.params
    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return apiError('Enter a valid name or URL', 400, { code: 'INVALID_PROJECT' })
    const target = parsed.data.url === undefined ? null : normalizeAuditNavigationUrl(parsed.data.url)
    if (target && !target.ok) return apiError('Enter a valid name or URL', 400, { code: 'INVALID_PROJECT' })

    const project = await updateOwnedSiteIdentity({ projectId: id, userId: session.user.id }, {
      name: parsed.data.name, origin: target?.ok ? new URL(target.url).origin : undefined,
    })

    return NextResponse.json(project)
  } catch (error) {
    return handleRouteError(error, 'Could not update project')
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to delete projects', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    const { id } = await context.params
    const raw = await req.text()
    let body: unknown
    try { body = raw ? JSON.parse(raw) : {} }
    catch { return apiError('Choose valid Site removal options.', 400) }
    const parsed = siteRemovalSchema.safeParse(body)
    if (!parsed.success) return apiError('Choose valid Site removal options.', 400)
    const result = await removeSite({ projectId: id, userId: session.user.id }, parsed.data)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return handleRouteError(error, 'Could not delete project')
  }
}
