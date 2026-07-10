import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleRouteError } from '@/lib/api/errors'
import { isAdminUser, getCheckUsage } from '@/lib/auth/permissions'
import { getEntitlements } from '@/lib/auth/entitlements'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { recordRateLimit } from '@/lib/security/rate-limit'

export async function GET(request: Request) {
  try {
    const clientId = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'
    await recordRateLimit({ scope: 'api-me', identifier: clientId, limit: 60, windowSeconds: 60 })

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)

    if (!session?.user?.id) {
      return NextResponse.json({ user: null })
    }

    const shouldClaim = new URL(request.url).searchParams.get('claim') === '1'
    const claimedCount = shouldClaim
      ? await claimAnonymousAudits(session.user.id)
      : 0

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        plan: true,
        name: true,
        role: true,
        auditsUsed: true,
        auditsLimit: true,
        subscriptionStatus: true,
        vibecodingLevel: true,
        preferredTools: true,
      },
    })

    if (!user) {
      return NextResponse.json({ user: null })
    }

    const checks = await getCheckUsage({
      id: session.user.id,
      role: user.role,
      auditsUsed: user.auditsUsed,
      auditsLimit: user.auditsLimit,
    })

    const entitlements = getEntitlements({
      id: session.user.id,
      role: user.role,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
    })

    const response = NextResponse.json({
      claimedCount,
        user: {
          id: session.user.id,
          email: user.email ?? session.user.email,
          name: user.name ?? session.user.name,
          plan: user.plan ?? 'FREE',
          role: user.role,
          isAdmin: isAdminUser({ id: session.user.id, role: user.role }),
          checks,
          entitlements,
          vibecodingLevel: user.vibecodingLevel,
          preferredTools: user.preferredTools,
        },
    })
    response.headers.set('Cache-Control', 'private, max-age=10')
    return response
  } catch (err) {
    return handleRouteError(err)
  }
}
