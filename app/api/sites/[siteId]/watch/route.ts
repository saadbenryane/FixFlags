import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { allowedWatchIntervals } from '@/lib/auth/entitlements'
import { prisma } from '@/lib/db'

const schema = z.object({
  interval: z.enum(['weekly', 'daily']).nullable(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ siteId: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Sign in to keep watching this Site.', signup: true },
        { status: 401 }
      )
    }

    const { siteId } = await context.params
    const access = await requireSiteAccess(siteId)
    if (!access.ok) return apiError(access.message, access.status)

    const body = schema.safeParse(await req.json().catch(() => ({})))
    if (!body.success) return apiError('Choose a watch interval', 400)

    let interval = body.data.interval
    if (interval) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, subscriptionStatus: true, role: true, id: true },
      })
      if (user) {
        const allowed = allowedWatchIntervals(user)
        if (allowed.length === 0) {
          return apiError('Watching is not available on this plan', 403)
        }
        if (!allowed.includes(interval)) {
          // Prefer the richest allowed cadence when the client asks above plan.
          interval = allowed.includes('daily') ? 'daily' : allowed[0]!
        }
      }
    }

    const result = await executeSiteCommand({
      type: 'SET_WATCH',
      siteId: access.decision.site.siteId,
      userId: session.user.id,
      interval,
    })

    if ('ok' in result && result.ok === false) {
      return apiError(result.error, 400, { code: 'code' in result ? result.code : undefined })
    }
    return NextResponse.json({ ok: true, interval })
  } catch (error) {
    return handleRouteError(error)
  }
}
