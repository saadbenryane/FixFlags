import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { getCreditPack, getCredPackStripePriceId, CREDIT_PACKS } from '@/lib/billing/credits'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getAppUrl } from '@/lib/get-app-url'

const PACK_IDS = CREDIT_PACKS.map((p) => p.id) as [string, ...string[]]
const schema = z.object({
  packId: z.enum(PACK_IDS),
})

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'stripe_credit_pack',
      identifier: requestClientId(req.headers),
      limit: 10,
      windowSeconds: 60,
    })
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return apiError('Sign in to purchase credits', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Select a valid credit pack', 400, { code: 'INVALID_PACK' })

    const pack = getCreditPack(parsed.data.packId)
    if (!pack) return apiError('Credit pack not found', 400, { code: 'INVALID_PACK' })

    const priceId = getCredPackStripePriceId(pack.id)
    if (!priceId) return apiError('Credit packs are not configured', 503, { code: 'BILLING_NOT_CONFIGURED' })

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user || user.plan === 'FREE') return apiError('Upgrade to a paid plan before purchasing credits', 403, { code: 'PLAN_UPGRADE_REQUIRED', action: 'view_pricing' })

    const appUrl = getAppUrl()

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: user?.stripeCustomerId ?? undefined,
      customer_email: user?.stripeCustomerId ? undefined : session.user.email,
      success_url: `${appUrl}/billing?credits=1&pack=${pack.id}`,
      cancel_url: `${appUrl}/billing`,
      metadata: {
        type: 'credit_pack',
        userId: session.user.id,
        packId: pack.id,
        credits: String(pack.credits),
      },
    })

    await prisma.creditPurchase.create({
      data: {
        userId: session.user.id,
        stripeSessionId: checkoutSession.id,
        packId: pack.id,
        creditsPurchased: pack.credits,
        creditsRemaining: 0,
        priceUsdCents: pack.priceUsdCents,
        status: 'PENDING',
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    return handleRouteError(error, 'Could not start credit pack checkout')
  }
}
