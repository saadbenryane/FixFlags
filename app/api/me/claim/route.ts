import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { meUserSelect, serializeMeUser } from '@/lib/auth/me-user'
import { ProductLimitReached } from '@/lib/billing/product-capacity'

export async function POST() {
  try {
    const requestHeaders = await headers()
    const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null)
    if (!session?.user?.id) return apiError('Unauthorized', 401)

    await enforceRateLimit({
      scope: 'me-claim',
      identifier: `${session.user.id}:${requestClientId(requestHeaders)}`,
      limit: 10,
      windowSeconds: 60,
    })

    const claimedCount = await claimAnonymousAudits(session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: meUserSelect,
    })

    return NextResponse.json({
      claimedCount,
      user: user ? await serializeMeUser(user, session.user) : null,
    })
  } catch (error) {
    if (error instanceof ProductLimitReached) {
      return apiError(
        `Your plan supports ${error.limit} ${error.limit === 1 ? 'Product' : 'Products'}. Choose an existing Product or see the paid plans.`,
        409,
        { code: 'PROJECT_LIMIT', action: 'upgrade' }
      )
    }
    return handleRouteError(error)
  }
}
