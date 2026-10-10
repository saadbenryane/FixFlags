import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { executeSiteCommand } from '@/lib/sites/application/commands'
import { requireSiteOwner, requireSiteAccess } from '@/lib/sites/request-access'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { allowedWatchIntervals } from '@/lib/auth/entitlements'
import { prisma } from '@/lib/db'

const schema = z.object({
  interval: z.enum(['weekly', 'daily']).nullable(),
})

/** Richest cadence first, so a fallback always picks the best one a plan allows. */
const CADENCE_ORDER = ['daily', 'weekly'] as const
type WatchInterval = (typeof CADENCE_ORDER)[number]

type WatchRejection = { ok: false; error: string; code?: string }

/** `executeSiteCommand` returns one union across every Site command. */
function isWatchRejection(result: { ok: boolean }): result is WatchRejection {
  return result.ok === false
}

/** Same machine codes and statuses the Product watch route already answers with. */
const STATUS_BY_CODE: Record<string, number> = {
  INTERVAL_NOT_ALLOWED: 403,
  STUDIO_REQUIRED: 403,
  WATCH_UNAVAILABLE: 503,
}

function statusForCode(code?: string): number {
  return (code ? STATUS_BY_CODE[code] : undefined) ?? 400
}

/**
 * Best cadence this account is actually entitled to, or null when Watch is not
 * available at all. Reads the same plan gate the save path uses, so it can never
 * propose a cadence the domain would reject.
 */
async function bestEntitledInterval(userId: string): Promise<WatchInterval | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionStatus: true, role: true, id: true },
  })
  if (!user) return null
  const allowed = allowedWatchIntervals(user)
  return CADENCE_ORDER.find((interval) => allowed.includes(interval)) ?? null
}

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

    const requested = body.data.interval
    const site = access.decision.site.siteId

    // Ask for exactly the cadence the customer chose. A cadence the plan does not
    // include is rejected by the domain, so this route never has to save one
    // cadence while reporting another.
    const result = await executeSiteCommand({
      type: 'SET_WATCH',
      siteId: site,
      userId: session.user.id,
      interval: requested,
    })

    if (isWatchRejection(result) && result.code === 'INTERVAL_NOT_ALLOWED') {
      const applied = await bestEntitledInterval(session.user.id)
      if (!applied) {
        return apiError(result.error, statusForCode(result.code), { code: result.code })
      }

      const entitled = await executeSiteCommand({
        type: 'SET_WATCH',
        siteId: site,
        userId: session.user.id,
        interval: applied,
      })
      if (isWatchRejection(entitled)) {
        return apiError(entitled.error, statusForCode(entitled.code), { code: entitled.code })
      }

      // The account asked for a cadence it cannot have. Keep the best cadence it
      // is entitled to and report both what was applied and why, so the client
      // can tell the customer instead of leaving them to believe it was saved.
      return NextResponse.json({
        ok: true,
        interval: applied,
        requested,
        code: result.code,
        message: result.error,
      })
    }

    if (isWatchRejection(result)) {
      return apiError(result.error, statusForCode(result.code), { code: result.code })
    }

    return NextResponse.json({ ok: true, interval: requested })
  } catch (error) {
    return handleRouteError(error)
  }
}


/** Only the owner may read account-specific activation options. */
export async function GET(_req: NextRequest, context: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await context.params
    const access = await requireSiteOwner(siteId)
    if (!access.ok) return apiError(access.message, access.status)
    const { monitoringOptions } = await import('@/lib/sites/application/monitoring-activation')
    return NextResponse.json({ intervals: await monitoringOptions(access.decision.site.userId!) })
  } catch (error) { return handleRouteError(error, 'We couldn’t load your monitoring options.') }
}
