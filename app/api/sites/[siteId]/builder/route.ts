import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { requireSiteOwner } from '@/lib/sites/request-access'
import { builderReportSchema, loadReportedBuilder, reportBuilder } from '@/lib/sites/application/builder-report'

type Context = { params: Promise<{ siteId: string }> }
const PRIVATE = { 'Cache-Control': 'private, no-store' }

async function owner(context: Context) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
  if (!session?.user?.id) return apiError('Sign in to answer for this website.', 401)
  const access = await requireSiteOwner((await context.params).siteId)
  if (!access.ok) return apiError(access.message, access.status)
  return { projectId: access.projectId, userId: session.user.id }
}

export async function GET(_request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (access instanceof Response) return access
    return NextResponse.json({ tool: await loadReportedBuilder(access.projectId) }, { headers: PRIVATE })
  } catch (error) { return handleRouteError(error) }
}

export async function POST(request: Request, context: Context) {
  try {
    const access = await owner(context)
    if (access instanceof Response) return access
    const input = builderReportSchema.safeParse(await request.json().catch(() => null))
    if (!input.success) return apiError('Choose one of the listed tools.', 400)
    return NextResponse.json({ tool: await reportBuilder({ ...access, tool: input.data.tool }) }, { headers: PRIVATE })
  } catch (error) { return handleRouteError(error) }
}
