import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getStripe } from '@/lib/stripe'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { getAppUrl } from '@/lib/get-app-url'
import { Plan } from '@prisma/client'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isPaidOpenServer } from '@/lib/billing/paid-open'
import { hasPlanAccessGranted } from '@/lib/billing/waitlist'
import {
  tierCheckoutDiscounts,
  type TierCheckoutPlan,
} from '@/lib/billing/discount-tiers'

const PAID_PLANS = Object.values(PLAN_DEFINITIONS)
  .filter((def) => def.plan !== 'FREE' && def.stripePriceId)
  .map((def) => def.plan)

const schema = z.object({
  plan: z.enum(PAID_PLANS as [string, ...string[]]),
})

export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({
      scope: 'stripe_checkout',
      identifier: requestClientId(req.headers),
      limit: 10,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return apiError('Sign in to start checkout', 401, { code: 'UNAUTHORIZED', action: 'sign_in' })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Select a valid plan', 400, { code: 'INVALID_PLAN' })

    const plan = parsed.data.plan as Plan
    const priceId = PLAN_DEFINITIONS[plan]?.stripePriceId
    if (!priceId) {
      return apiError('This plan is not configured for checkout', 503, { code: 'BILLING_NOT_CONFIGURED' })
    }

    if (!isPaidOpenServer()) {
      return apiError('Paid checkout is not open yet. Join the waitlist on pricing.', 403, {
        code: 'PAID_CHECKOUT_CLOSED',
      })
    }

    // Batch gate: paid is open, but waitlist members need a released batch or
    // an explicit access grant (invite redeem or admin grant). Users with no
    // waitlist row are governed by the master switch alone (legacy behavior).
    const hasAccess = await hasPlanAccessGranted(session.user.id, plan)
    if (!hasAccess) {
      const planLabel =
        PLAN_DEFINITIONS[plan]?.label ?? (plan === 'TEAM' ? 'Studio' : 'Pro')
      return apiError(
        `${planLabel} opens in batches. Your batch has not been released yet, so checkout is not open for you. Join the waitlist to hold your spot.`,
        403,
        { code: 'BATCH_ACCESS_REQUIRED' }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        plan: true,
        subscriptionStatus: true,
      },
    })
    const appUrl = getAppUrl()

    const hasActiveSubscription =
      Boolean(user?.stripeSubscriptionId) &&
      Boolean(user?.stripeCustomerId) &&
      user?.plan !== 'FREE' &&
      !hasRevokedSubscriptionStatus(user?.subscriptionStatus ?? '')

    if (hasActiveSubscription && user?.stripeCustomerId) {
      const portalSession = await getStripe().billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${appUrl}/billing`,
      })
      return NextResponse.json(
        {
          url: portalSession.url,
          code: 'EXISTING_SUBSCRIPTION',
          message: 'You already have a subscription. Manage it in the billing portal.',
        },
        { status: 409 }
      )
    }

    // Auto-apply the launch discount tier when the user holds a waitlist spot.
    // Discount codes are never customer-enterable: a user without a tier gets
    // no promotion codes at all, so the 500/500 caps cannot be burned manually.
    const tierDiscount = await tierCheckoutDiscounts(plan as TierCheckoutPlan, session.user.id)
    const metadata: Record<string, string> = {
      userId: session.user.id,
      plan,
    }
    if (tierDiscount) metadata.discount_tier = String(tierDiscount.tier)

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer: user?.stripeCustomerId ?? undefined,
      customer_email: user?.stripeCustomerId ? undefined : session.user.email,
      billing_address_collection: 'required',
      automatic_tax: { enabled: true },
      customer_update: user?.stripeCustomerId
        ? { address: 'auto', name: 'auto' }
        : undefined,
      success_url: `${appUrl}/dashboard?upgraded=1&plan=${plan}`,
      cancel_url: `${appUrl}/pricing`,
      ...(tierDiscount
        ? { discounts: [{ promotion_code: tierDiscount.promotion_code }] }
        : {}),
      metadata,
      subscription_data: {
        metadata,
      },
    })

    return NextResponse.json({ url: checkoutSession.url })
  } catch (error) {
    return handleRouteError(error, 'Could not start checkout')
  }
}
