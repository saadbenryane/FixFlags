'use client'
import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PRICING } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { pickPlan, routerForPlanResult } from '@/lib/billing/pick-plan'
import { BetaInterestForm } from '@/components/billing/BetaInterestForm'

interface Props {
  plan: 'FREE' | 'BUILDER' | 'TEAM'
  cta: string
  signUpHref: Route
  highlight?: boolean
  isLoggedIn: boolean
  currentPlan: string
  betaGated?: boolean
  userEmail?: string
}

export function PricingCTAButton({
  plan,
  cta,
  signUpHref,
  highlight,
  isLoggedIn,
  currentPlan,
  betaGated = false,
  userEmail,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showBetaForm, setShowBetaForm] = useState(false)

  const isCurrent = isLoggedIn && currentPlan === plan
  const isPaidPlan = plan !== 'FREE'

  async function handleClick() {
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
      betaGated,
      userEmail,
      onPrivateBeta: () => setShowBetaForm(true),
      onCheckoutRedirect: (url) => {
        window.location.href = url
      },
    })
    setLoading(false)

    if (result.kind === 'private_beta') {
      setShowBetaForm(true)
      return
    }
    if (result.kind === 'checkout_redirect') return
    if (result.kind === 'unavailable' || result.kind === 'error') return

    routerForPlanResult(router, result)
  }

  if (showBetaForm && isPaidPlan) {
    return <BetaInterestForm plan={plan} initialEmail={userEmail} />
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
          : betaGated && isPaidPlan
            ? 'Join private beta'
            : cta}
      </Button>
      {isPaidPlan && !isCurrent && (
        <p className="text-3xs text-center text-muted-foreground leading-snug">
          {betaGated
            ? 'Paid features are in private beta. Request an invitation above.'
            : isLoggedIn
              ? PRICING.upgradeStepsLoggedIn
              : PRICING.upgradeSteps}
        </p>
      )}
      {isPaidPlan && !isLoggedIn && !betaGated && (
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
