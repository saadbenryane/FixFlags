import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { loadSiteBoardFlag } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'

const bodySchema = z.object({
  changeSummary: z.string().trim().max(2000).optional(),
})

export async function POST(
  req: Request,
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

    // The attempt records what the customer said they changed. It is optional on
    // purpose: a customer who fixed the code and has nothing to add still deserves
    // an independent check, and an empty description is honest where an invented one
    // is not.
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return apiError('Invalid change summary', 400)

    const result = await executeSiteCommand({
      type: 'VERIFY_FLAG',
      siteId: resolvedId,
      userId: session.user.id,
      flagId,
      idempotencyKey: req.headers.get('Idempotency-Key')?.trim() || undefined,
      source: 'WEB',
      ...(parsed.data.changeSummary ? { changeSummary: parsed.data.changeSummary } : {}),
    })

    if (!result.ok) return apiError(result.error, 400)
    if (!('runId' in result)) return apiError('Verification could not be started', 500)
    return NextResponse.json({
      ...result,
      accepted: true,
      runRequestId: result.runId,
    }, { status: 202 })
  } catch (error) {
    return handleRouteError(error)
  }
}
