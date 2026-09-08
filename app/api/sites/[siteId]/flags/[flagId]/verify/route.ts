import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

export async function POST(
  _req: Request,
  context: { params: Promise<{ siteId: string; flagId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to verify a fix on this Site.', signup: true },
        { status: 401 }
      )
    }

    const { siteId, flagId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const resolvedId = access.decision.site.siteId
    if (access.decision.role !== 'owner') {
      return NextResponse.json(
        { error: 'Claim this Site before verifying a fix.', signup: true },
        { status: 401 }
      )
    }

    const detail = await loadSiteBoardFlag(resolvedId, flagId)
    if (!detail) return apiError('Flag not found', 404)

    const sourceAuditId = detail.site.primaryAuditId
    if (!sourceAuditId) return apiError('No analysis to verify against yet', 400)

    const result = await executeSiteCommand({
      type: 'VERIFY_FLAG',
      siteId: resolvedId,
      userId: session.user.id,
      sourceAuditId,
    })

    if (!result.ok) return apiError(result.error, 400)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
