'use client'
import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BILLING_ACTION_COPY, PRICING, SYSTEM_COPY } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'
import { requestPlanCheckout } from '@/lib/billing/client-checkout'
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

export function PricingCTAButton({ plan, cta, signUpHref, highlight, isLoggedIn, currentPlan, betaGated, userEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showBetaForm, setShowBetaForm] = useState(false)

  const isCurrent = isLoggedIn && currentPlan === plan
  const isPaidPlan = plan !== 'FREE'

  async function handleClick() {
    if (plan !== 'FREE') {
      trackEvent('started_checkout', { plan, is_logged_in: isLoggedIn })
    }

    if (!isLoggedIn) {
      router.push(signUpHref)
      return
    }

    if (plan === 'FREE') {
      router.push('/dashboard')
      return
    }

    if (betaGated) {
      setShowBetaForm(true)
      return
    }

    setLoading(true)
    const outcome = await requestPlanCheckout(plan)
    setLoading(false)

    if (outcome.kind === 'private-beta') {
      setShowBetaForm(true)
      return
    }
    if (outcome.kind === 'redirect') {
      if (outcome.existingSubscription) {
        toast.message(BILLING_ACTION_COPY.checkout.existingTitle, {
          description: BILLING_ACTION_COPY.checkout.existingBody,
        })
      }
      window.location.href = outcome.url
      return
    }
    if (outcome.kind === 'unavailable') {
      toast.error(BILLING_ACTION_COPY.checkout.unavailableTitle, {
        description: outcome.message,
        action: {
          label: SYSTEM_COPY.actions.billing,
          onClick: () => router.push('/billing'),
        },
      })
      return
    }
    toast.error(
      outcome.kind === 'error'
        ? outcome.message
        : BILLING_ACTION_COPY.checkout.missingDestination
    )
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
        loadingLabel={BILLING_ACTION_COPY.checkout.redirecting}
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
