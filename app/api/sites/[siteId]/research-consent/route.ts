import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { loadResearchConsent, saveResearchConsent } from '@/lib/growth/research-consent'
import { researchConsentWriteSchema } from '@/lib/growth/research-consent-contract'

type Context = { params: Promise<{ siteId: string }> }

async function owner(context: Context) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) return apiError('Sign in to change research permission.', 401)
  const access = await requireSiteOwner((await context.params).siteId)
  if (!access.ok) return apiError(access.message, access.status)
  return { projectId: access.projectId, userId: session.user.id }
}

export async function GET(_request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (access instanceof Response) return access
    return NextResponse.json(await loadResearchConsent(access), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleRouteError(error) }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (access instanceof Response) return access
    const input = researchConsentWriteSchema.safeParse(await request.json().catch(() => null))
    if (!input.success) return apiError('Review the current research permission before enabling it.', 400)
    return NextResponse.json(await saveResearchConsent(access, input.data), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return handleRouteError(error) }
}
