'use client'

import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { useSiteAction } from '@/hooks/useSiteAction'
import { appendAuthParams, buildPostLoginQuery, PAID_PLANS, postAuthDestination, sanitizeFunnelFrom, sanitizeNextPath } from '@/lib/auth/redirects'
import type { CheckoutPlan } from '@/lib/billing/client-checkout'
import { withClientDeadline } from '@/lib/api/client-request'

export { buildPostLoginQuery, postAuthDestination, sanitizeFunnelFrom, sanitizeNextPath } from '@/lib/auth/redirects'

export function useAuthRedirect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const next = useMemo(
    () => sanitizeNextPath(searchParams.get('next')),
    [searchParams]
  )
  const plan = searchParams.get('plan')
  const from = useMemo(
    () => sanitizeFunnelFrom(searchParams.get('from')),
    [searchParams]
  )
  const { submit } = useSiteAction({ scope: JSON.stringify(['post-login-navigation', next, plan, from]) })

  const oauthCallbackURL = useMemo(
    () => buildPostLoginQuery(next, plan, from),
    [next, plan, from]
  )
  // Email flows replace the auth screen here so /post-login is the single post-auth
  // path: it claims anonymous audits, then runs checkout/next navigation.
  // Navigating straight to `next` skips the claim and leaves reports locked.
  const postLoginHref = oauthCallbackURL
  const oauthNewUserCallbackURL = useMemo(
    () => buildPostLoginQuery(next, plan, from, { newUser: true }),
    [next, plan, from]
  )

  const navigateAfterAuth = useCallback(async () => {
    const failedCheckout = (description = 'Complete payment from the pricing page.') => {
      toast.error('Could not start checkout', {
        description,
        action: {
          label: 'View pricing',
          onClick: () => router.push(`/pricing?plan=${plan}`),
        },
      })
      router.push('/pricing')
    }
    const completion = await submit(async signal => {
      if (!plan || !PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) return null
      return withClientDeadline(async checkoutSignal => {
        const { requestPlanCheckout } = await import('@/lib/billing/client-checkout')
        if (checkoutSignal.aborted) return null
        return requestPlanCheckout(plan as CheckoutPlan, checkoutSignal)
      }, signal)
    }, outcome => {
      if (!outcome) router.replace(postAuthDestination(next))
      else if (outcome.kind === 'redirect') window.location.assign(outcome.url)
      else failedCheckout(outcome.kind === 'error' || outcome.kind === 'unavailable' ? outcome.message : undefined)
      return null
    })
    if (completion.kind === 'refused') failedCheckout()
  }, [next, plan, router, submit])

  function signInHref(extraNext?: string): Route {
    const params = new URLSearchParams()
    appendAuthParams(params, extraNext ?? next, plan, from)
    const qs = params.toString()
    return (qs ? `/sign-in?${qs}` : '/sign-in') as Route
  }

  function signUpHref(): Route {
    const params = new URLSearchParams()
    appendAuthParams(params, next, plan, from)
    const qs = params.toString()
    return (qs ? `/sign-up?${qs}` : '/sign-up') as Route
  }

  return {
    next,
    plan,
    from,
    oauthCallbackURL,
    oauthNewUserCallbackURL,
    postLoginHref,
    navigateAfterAuth,
    signInHref,
    signUpHref,
  }
}
