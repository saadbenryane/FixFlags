import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getStripe } from '@/lib/stripe'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { getAppUrl } from '@/lib/get-app-url'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to manage billing', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const clientId = requestClientId(await headers())
    await enforceRateLimit({ scope: 'stripe-portal', identifier: `${session.user.id}:${clientId}`, limit: 10, windowSeconds: 60 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, plan: true },
  })

    if (!user?.stripeCustomerId || user.plan === 'FREE') {
      return apiError('No active subscription was found', 400, { code: 'NO_ACTIVE_SUBSCRIPTION', action: 'view_pricing' })
    }

  const appUrl = getAppUrl()
  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/billing`,
  })

    return NextResponse.json({ url: portalSession.url })
  } catch (error) {
    return handleRouteError(error, 'Could not open the billing portal')
  }
}
