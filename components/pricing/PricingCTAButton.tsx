'use client'
import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PRICING, BILLING_ACTION_COPY } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { pickPlan, routerForPlanResult } from '@/lib/billing/pick-plan'
import { waitlistPathForPlan } from '@/components/billing/WaitlistAuthDialog'
import { isPaidCheckoutGatedClient } from '@/lib/billing/paid-open'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'

interface Props {
  plan: 'FREE' | 'BUILDER' | 'TEAM'
  cta: string
  signUpHref: Route
  highlight?: boolean
  isLoggedIn: boolean
  currentPlan: string
  waitlistGated?: boolean
  userEmail?: string
}

export function PricingCTAButton({
  plan,
  cta,
  signUpHref,
  highlight,
  isLoggedIn,
  currentPlan,
  waitlistGated = isPaidCheckoutGatedClient(),
  userEmail,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const isCurrent = isLoggedIn && currentPlan === plan
  const isPaidPlan = plan !== 'FREE'

  async function handleClick() {
    // Waitlist mode: paid CTAs always lead to the waitlist page, signed in or
    // not. The waitlist page handles account creation and the join.
    if (waitlistGated && isPaidPlan) {
      router.push(waitlistPathForPlan(plan as CheckoutPlan) as Route)
      return
    }

    if (!isLoggedIn) {
      if (plan !== 'FREE') trackEvent('started_checkout', { plan, is_logged_in: isLoggedIn })
      router.push(signUpHref)
      return
    }

    if (plan !== 'FREE') {
      trackEvent('started_checkout', { plan, is_logged_in: isLoggedIn })
    }

    setLoading(true)
    const result = await pickPlan({
      plan,
      source: 'pricing',
      isLoggedIn,
      currentPlan,
      waitlistGated,
      userEmail,
      onCheckoutRedirect: (url) => {
        window.location.href = url
      },
    })
    setLoading(false)

    if (result.kind === 'waitlist') {
      router.push(waitlistPathForPlan(plan as CheckoutPlan) as Route)
      return
    }
    if (result.kind === 'checkout_redirect') return
    if (result.kind === 'unavailable' || result.kind === 'error') return

    routerForPlanResult(router, result)
  }

  return (
    <div className="space-y-2">
      <Button
        className="w-full"
        variant={highlight ? 'default' : 'outline'}
        disabled={loading || isCurrent}
        loading={loading}
        loadingLabel={PRICING.checkoutRedirecting}
        onClick={handleClick}
      >
        {isCurrent
          ? 'Current plan'
          : waitlistGated && isPaidPlan
            ? plan === 'TEAM'
              ? BILLING_ACTION_COPY.beta.gatedStudioCta
              : BILLING_ACTION_COPY.beta.gatedProCta
            : cta}
      </Button>
      {isPaidPlan && !isCurrent && (
        <p className="text-3xs text-center text-muted-foreground leading-snug">
          {waitlistGated
            ? BILLING_ACTION_COPY.beta.gatedHint
            : isLoggedIn
              ? PRICING.upgradeStepsLoggedIn
              : PRICING.upgradeSteps}
        </p>
      )}
      {isPaidPlan && !isLoggedIn && !waitlistGated && (
        <p className="text-3xs text-center text-muted-foreground">
          <Link href={signUpHref} className="underline hover:text-foreground">
            Sign up first
          </Link>{' '}
          if you don&apos;t have an account.
        </p>
      )}
    </div>
  )
}
