'use client'

import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BILLING_ACTION_COPY, PRICING } from '@/lib/marketing/copy/plans'
import { trackEvent } from '@/lib/analytics/events'
import { waitlistPathForPlan } from '@/lib/billing/waitlist-path'
import { isPaidCheckoutGatedClient } from '@/lib/billing/paid-open'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'
import { useMe } from '@/hooks/useMe'

interface Props {
  plan: 'FREE' | 'BUILDER' | 'TEAM'
  cta: string
  signUpHref: Route
  highlight?: boolean
  isLoggedIn?: boolean
  currentPlan?: string
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
  const { user } = useMe()
  const [loading, setLoading] = useState(false)

  const resolvedLoggedIn = isLoggedIn ?? !!user
  const resolvedPlan = currentPlan ?? user?.plan ?? 'FREE'
  const resolvedEmail = userEmail ?? user?.email ?? undefined
  const isCurrent = resolvedLoggedIn && resolvedPlan === plan
  const isPaidPlan = plan !== 'FREE'

  async function handleClick() {
    if (waitlistGated && isPaidPlan) {
      router.push(waitlistPathForPlan(plan as CheckoutPlan) as Route)
      return
    }

    if (!resolvedLoggedIn) {
      if (plan !== 'FREE') trackEvent('started_checkout', { plan, is_logged_in: resolvedLoggedIn })
      router.push(signUpHref)
      return
    }

    if (plan !== 'FREE') {
      trackEvent('started_checkout', { plan, is_logged_in: resolvedLoggedIn })
    }

    setLoading(true)
    try {
      const { pickPlan, routerForPlanResult } = await import('@/lib/billing/pick-plan')
      const result = await pickPlan({
        plan,
        source: 'pricing',
        isLoggedIn: resolvedLoggedIn,
        currentPlan: resolvedPlan,
        waitlistGated,
        userEmail: resolvedEmail,
        onCheckoutRedirect: (url) => {
          window.location.href = url
        },
      })

      if (result.kind === 'demo' && result.url) {
        router.push(result.url as Route)
        return
      }
      if (result.kind === 'waitlist') {
        router.push((result.url ?? waitlistPathForPlan(plan as CheckoutPlan)) as Route)
        return
      }
      if (result.kind === 'checkout_redirect') return
      if (result.kind === 'unavailable' || result.kind === 'error') return

      routerForPlanResult(router, result)
    } finally {
      setLoading(false)
    }
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
              ? BILLING_ACTION_COPY.waitlist.submitStudio
              : BILLING_ACTION_COPY.waitlist.submitPro
            : cta}
      </Button>
      {isPaidPlan && !isCurrent && (
        <p className="text-3xs text-center text-muted-foreground leading-snug">
          {waitlistGated
            ? BILLING_ACTION_COPY.waitlist.description
            : resolvedLoggedIn
              ? PRICING.upgradeStepsLoggedIn
              : PRICING.upgradeSteps}
        </p>
      )}
      {isPaidPlan && !resolvedLoggedIn && !waitlistGated && (
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
