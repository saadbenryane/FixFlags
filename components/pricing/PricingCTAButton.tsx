'use client'
import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PRICING } from '@/lib/marketing/copy'
import { trackEvent } from '@/lib/analytics/events'

interface Props {
  plan: 'FREE' | 'BUILDER' | 'TEAM'
  cta: string
  signUpHref: Route
  highlight?: boolean
  isLoggedIn: boolean
  currentPlan: string
}

export function PricingCTAButton({ plan, cta, signUpHref, highlight, isLoggedIn, currentPlan }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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

    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        url?: string
        error?: string
        message?: string
      }
      if (data.url && (res.ok || res.status === 409)) {
        if (res.status === 409) {
          toast.message('You already have a subscription', {
            description: 'Opening the billing portal to change plans.',
          })
        }
        window.location.href = data.url
        return
      }
      if (!res.ok) {
        if (res.status === 503) {
          toast.error('Checkout is not configured yet.', {
            description: 'Set Stripe price IDs or manage billing from your dashboard.',
            action: {
              label: 'Billing',
              onClick: () => router.push('/billing'),
            },
          })
        } else {
          toast.error(data.error ?? data.message ?? 'Could not start checkout')
        }
        return
      }
      toast.error('Checkout did not return a destination.', {
        action: {
          label: 'Try billing',
          onClick: () => router.push('/billing'),
        },
      })
    } catch {
      toast.error('Could not start checkout. Try again.')
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
        onClick={handleClick}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {loading && isPaidPlan
          ? 'Redirecting to checkout…'
          : isCurrent
            ? 'Current plan'
            : cta}
      </Button>
      {isPaidPlan && !isCurrent && (
        <p className="text-3xs text-center text-muted-foreground leading-snug">
          {isLoggedIn ? PRICING.upgradeStepsLoggedIn : PRICING.upgradeSteps}
        </p>
      )}
      {isPaidPlan && !isLoggedIn && (
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
