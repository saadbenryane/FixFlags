'use client'

import { useCallback, useMemo } from 'react'
import type { Route } from 'next'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

const PAID_PLANS = ['BUILDER', 'TEAM'] as const
const FUNNEL_SOURCES = ['pricing', 'report', 'hero', 'final'] as const

export function sanitizeNextPath(next: string | null): Route | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  return next as Route
}

export function sanitizeFunnelFrom(from: string | null): string | null {
  if (!from) return null
  return FUNNEL_SOURCES.includes(from as (typeof FUNNEL_SOURCES)[number]) ? from : null
}

function appendAuthParams(
  params: URLSearchParams,
  next: string | null,
  plan: string | null,
  from: string | null
) {
  if (next) params.set('next', next)
  if (plan && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
    params.set('plan', plan)
  }
  if (from) params.set('from', from)
}

export function buildPostLoginQuery(
  next: string | null,
  plan: string | null,
  from: string | null,
  options?: { newUser?: boolean }
): Route {
  const params = new URLSearchParams()
  appendAuthParams(params, next, plan, from)
  // Marks first-time OAuth accounts (better-auth's newUserCallbackURL) so
  // post-login can fire the signed_up event; email signups track on the form.
  if (options?.newUser) params.set('signup', '1')
  const qs = params.toString()
  return (qs ? `/post-login?${qs}` : '/post-login') as Route
}

export function postAuthDestination(next: string | null): Route {
  return sanitizeNextPath(next) ?? '/dashboard'
}

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

  const oauthCallbackURL = useMemo(
    () => buildPostLoginQuery(next, plan, from),
    [next, plan, from]
  )
  // Email flows push here after auth so /post-login is the single post-auth
  // path: it claims anonymous audits, then runs checkout/next navigation.
  // Navigating straight to `next` skips the claim and leaves reports locked.
  const postLoginHref = oauthCallbackURL
  const oauthNewUserCallbackURL = useMemo(
    () => buildPostLoginQuery(next, plan, from, { newUser: true }),
    [next, plan, from]
  )

  const navigateAfterAuth = useCallback(async () => {
    if (plan && PAID_PLANS.includes(plan as (typeof PAID_PLANS)[number])) {
      const checkoutRes = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const payload = await checkoutRes.json().catch(() => ({}))
      if (payload?.url && (checkoutRes.ok || checkoutRes.status === 409)) {
        window.location.href = payload.url
        return
      }
      toast.error('Could not start checkout', {
        description: payload?.error ?? 'Complete payment from the pricing page.',
        action: {
          label: 'View pricing',
          onClick: () => router.push(`/pricing?plan=${plan}`),
        },
      })
      router.push('/pricing')
      return
    }

    // `/post-login` has already claimed any anonymous Review. Honor the user's
    // explicit destination next; ordinary authentication lands on the URL-first
    // dashboard instead of inserting a pricing decision into the product loop.
    router.push(postAuthDestination(next))
  }, [next, plan, from, router])

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
