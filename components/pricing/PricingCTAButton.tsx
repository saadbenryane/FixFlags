'use client'
import type { Route } from 'next'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, CheckCircle2 } from 'lucide-react'
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
  betaGated?: boolean
  userEmail?: string
}

export function PricingCTAButton({ plan, cta, signUpHref, highlight, isLoggedIn, currentPlan, betaGated, userEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [betaState, setBetaState] = useState<'idle' | 'submitting' | 'done'>('idle')
  const [betaEmail, setBetaEmail] = useState(userEmail ?? '')

  const isCurrent = isLoggedIn && currentPlan === plan
  const isPaidPlan = plan !== 'FREE'

  async function handleBetaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!betaEmail) return
    setBetaState('submitting')
    try {
      const res = await fetch('/api/stripe/beta-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: betaEmail, plan, name: '' }),
      })
      if (res.ok) {
        setBetaState('done')
        trackEvent('beta_interest_submitted', { plan, email: betaEmail })
      } else {
        toast.error('Could not submit. Try again.')
        setBetaState('idle')
      }
    } catch {
      toast.error('Could not submit. Try again.')
      setBetaState('idle')
    }
  }

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
        code?: string
        error?: string
        message?: string
      }
      if (data.code === 'PRIVATE_BETA') {
        setBetaState('idle')
        return
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

  if (betaState === 'done') {
    return (
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          You&apos;re on the list.
        </div>
        <p className="text-3xs text-muted-foreground">
          We&apos;ll reach out when {plan === 'TEAM' ? 'Studio' : 'Pro'} is ready.
        </p>
      </div>
    )
  }

  if (betaState !== 'idle') {
    return (
      <form onSubmit={handleBetaSubmit} className="space-y-2">
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="you@example.com"
            value={betaEmail}
            onChange={(e) => setBetaEmail(e.target.value)}
            required
            disabled={betaState === 'submitting'}
            className="flex-1"
          />
          <Button type="submit" disabled={betaState === 'submitting' || !betaEmail}>
            {betaState === 'submitting' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Join beta'
            )}
          </Button>
        </div>
        <p className="text-3xs text-center text-muted-foreground">
          Paid features are in private beta. Enter your email to get an invitation.
        </p>
      </form>
    )
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
